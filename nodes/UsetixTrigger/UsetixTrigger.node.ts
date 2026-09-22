import { randomUUID } from 'node:crypto';
import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
  type JsonObject,
  type IDataObject,
  type IHookFunctions,
  type ILoadOptionsFunctions,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
} from 'n8n-workflow';
import { authentication, credentials, event } from '../Usetix/fields';
import { events, matchesEvent, request } from '../Usetix/api';
import catalog from './events.json';

type Hook = IDataObject & {
  id: number;
  name: string;
  active: boolean;
  url: string;
  subscribed_actions: string[];
};
function missing(error: unknown): boolean {
  return (error as { httpCode?: string }).httpCode === '404';
}

function selectedEvents(context: IHookFunctions): string[] {
  const selected = context.getNodeParameter('events', []) as string[];
  if (!selected.length)
    throw new NodeOperationError(context.getNode(), 'Select at least one event');
  if (selected.some((action) => !catalog.some((event) => event.action === action))) {
    throw new NodeOperationError(context.getNode(), 'Select a supported Usetix event');
  }
  const slug = context.getNodeParameter('eventSlug', '') as string;
  if (
    slug &&
    selected.some((action) => !catalog.find((event) => event.action === action)?.eventScoped)
  ) {
    throw new NodeOperationError(
      context.getNode(),
      'Voucher notifications cannot be filtered by event. Use a separate trigger for vouchers.',
    );
  }
  return selected;
}

export class UsetixTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Usetix Trigger',
    name: 'usetixTrigger',
    icon: { light: 'file:../Usetix/usetix.svg', dark: 'file:../Usetix/usetix.dark.svg' },
    subtitle: '={{$parameter["events"].join(", ")}}',
    group: ['trigger'],
    version: 1,
    description: 'Start a workflow when an order, event, ticket, or voucher changes in Usetix',
    defaults: { name: 'Usetix Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials,
    webhooks: [
      { name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
    ],
    properties: [
      authentication,
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        default: ['order.paid'],
        required: true,
        options: catalog
          .map((event) => ({ name: event.label, value: event.action }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
      {
        ...event,
        required: false,
        description:
          'Choose an event, or leave empty to include every event you can access. Voucher notifications require an empty event filter.',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getEvents(this: ILoadOptionsFunctions) {
        return [
          { name: 'All Events', value: '' },
          ...(await events(this)).map((event) => ({ name: event.title, value: event.slug })),
        ];
      },
    },
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const selected = selectedEvents(this);
        const data = this.getWorkflowStaticData('node');
        const url = this.getNodeWebhookUrl('default');
        const hooks = await request<{ webhooks: Hook[] }>(this, '/admin/webhooks');
        const hook = hooks.webhooks.find(
          (hook) => hook.url === url && hook.name.startsWith('n8n ·'),
        );
        if (!hook) {
          delete data.webhookId;
          return false;
        }
        if (
          JSON.stringify([...hook.subscribed_actions].sort()) !==
          JSON.stringify([...selected].sort())
        ) {
          await request(this, `/admin/webhooks/${hook.id}`, {
            method: 'PATCH',
            body: { webhook: { subscribed_actions: selected } },
          });
        }
        if (!hook.active)
          await request(this, `/admin/webhooks/${hook.id}/activation`, { method: 'POST' });
        data.webhookId = String(hook.id);
        delete data.subscriptionRequestKey;
        return true;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const selected = selectedEvents(this);
        const data = this.getWorkflowStaticData('node');
        data.subscriptionRequestKey ||= randomUUID();
        const hook = await request<Hook>(this, '/admin/webhooks', {
          method: 'POST',
          headers: { 'Idempotency-Key': String(data.subscriptionRequestKey) },
          body: {
            webhook: {
              name: `n8n · ${this.getWorkflow().name || 'Workflow'}`,
              url: this.getNodeWebhookUrl('default'),
              subscribed_actions: selected,
            },
          },
        });
        data.webhookId = String(hook.id);
        delete data.subscriptionRequestKey;
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData('node');
        if (data.webhookId) {
          try {
            await request(this, `/admin/webhooks/${encodeURIComponent(String(data.webhookId))}`, {
              method: 'DELETE',
            });
          } catch (error) {
            if (!missing(error)) throw new NodeApiError(this.getNode(), error as JsonObject);
          }
        }
        delete data.webhookId;
        delete data.subscriptionRequestKey;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const headers = this.getHeaderData();
    const id = String(headers['x-webhook-id'] || '');
    const delivery = String(headers['x-webhook-delivery-id'] || '');
    const signature = String(headers['x-webhook-signature'] || '');
    const expectedId = String(this.getWorkflowStaticData('node').webhookId || '');
    if (
      !/^\d+$/.test(id) ||
      id !== expectedId ||
      !/^\d+$/.test(delivery) ||
      !/^[a-f0-9]{64}$/.test(signature)
    ) {
      this.getResponseObject().status(401).json({ error: 'Invalid Usetix webhook signature.' });
      return { noWebhookResponse: true };
    }
    let notification: IDataObject;
    try {
      // Read the signed original through the owning credential. The callback
      // body is untrusted and never becomes workflow data.
      notification = await request(this, `/admin/webhooks/${id}/deliveries/${delivery}`, {
        headers: { 'X-Webhook-Signature': signature },
      });
    } catch (error) {
      if (!missing(error)) throw new NodeApiError(this.getNode(), error as JsonObject);
      this.getResponseObject().status(401).json({ error: 'Invalid Usetix webhook signature.' });
      return { noWebhookResponse: true };
    }
    const selected = this.getNodeParameter('events', []) as string[];
    if (
      !selected.includes(String(notification.action)) ||
      !matchesEvent(notification, this.getNodeParameter('eventSlug', '') as string)
    )
      return {};
    return { workflowData: [this.helpers.returnJsonArray(notification)] };
  }
}
