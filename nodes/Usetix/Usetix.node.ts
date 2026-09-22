import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
  type JsonObject,
  type IDataObject,
  type IExecuteFunctions,
  type ILoadOptionsFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from 'n8n-workflow';
import { authentication, credentials, event, requestKey } from './fields';
import { events, request, tickets } from './api';

export class Usetix implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Usetix',
    name: 'usetix',
    icon: { light: 'file:usetix.svg', dark: 'file:usetix.dark.svg' },
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    group: ['transform'],
    version: 1,
    description: 'Manage events, orders, guest lists, and promo codes in Usetix',
    defaults: { name: 'Usetix' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials,
    properties: [
      authentication,
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        default: 'event',
        noDataExpression: true,
        options: [
          { name: 'Event', value: 'event' },
          { name: 'Guest', value: 'guest' },
          { name: 'Order', value: 'order' },
          { name: 'Promo Code', value: 'promoCode' },
          { name: 'Ticket', value: 'ticket' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'getAll',
        displayOptions: { show: { resource: ['event'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create an event' },
          { name: 'Get', value: 'get', action: 'Get an event' },
          { name: 'Get Many', value: 'getAll', action: 'Get many events' },
          { name: 'Publish', value: 'publish', action: 'Publish an event' },
          { name: 'Unpublish', value: 'unpublish', action: 'Unpublish an event' },
          { name: 'Update', value: 'update', action: 'Update an event' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'get',
        displayOptions: { show: { resource: ['order'] } },
        options: [{ name: 'Get', value: 'get', action: 'Get an order' }],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'create',
        displayOptions: { show: { resource: ['guest'] } },
        options: [{ name: 'Create', value: 'create', action: 'Create a guest party' }],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'create',
        displayOptions: { show: { resource: ['promoCode'] } },
        options: [{ name: 'Create', value: 'create', action: 'Create a promo code' }],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'getAll',
        displayOptions: { show: { resource: ['ticket'] } },
        options: [{ name: 'Get Many', value: 'getAll', action: 'Get guest ticket types' }],
      },
      {
        ...event,
        displayOptions: { hide: { resource: ['order'], operation: ['getAll', 'create'] } },
      },
      { ...event, displayOptions: { show: { resource: ['guest', 'promoCode', 'ticket'] } } },
      {
        displayName: 'Order ID or Code',
        name: 'reference',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['order'] } },
      },
      { ...requestKey, displayOptions: { show: { operation: ['create'] } } },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        displayOptions: { show: { resource: ['event', 'ticket'], operation: ['getAll'] } },
        description: 'Whether to return all results or only up to a given limit',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        typeOptions: { minValue: 1 },
        displayOptions: {
          show: { resource: ['event', 'ticket'], operation: ['getAll'], returnAll: [false] },
        },
        description: 'Max number of results to return',
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['event'], operation: ['create'] } },
      },
      {
        displayName: 'Venue Name or ID',
        name: 'venueId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getVenues' },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['event'], operation: ['create'] } },
        description:
          'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Starts At',
        name: 'startsAt',
        type: 'dateTime',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['event'], operation: ['create'] } },
      },
      {
        displayName: 'Ends At',
        name: 'endsAt',
        type: 'dateTime',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['event'], operation: ['create'] } },
      },
      {
        displayName: 'Event Fields',
        name: 'eventFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['event'], operation: ['create', 'update'] } },
        options: [
          {
            displayName: 'Capacity',
            name: 'capacity',
            type: 'number',
            default: 100,
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
            typeOptions: { rows: 4 },
          },
          { displayName: 'Ends At', name: 'ends_at', type: 'dateTime', default: '' },
          { displayName: 'Listed', name: 'listed', type: 'boolean', default: true },
          { displayName: 'Starts At', name: 'starts_at', type: 'dateTime', default: '' },
          { displayName: 'Title', name: 'title', type: 'string', default: '' },
        ],
      },
      {
        displayName: 'Ticket Name or ID',
        name: 'ticketId',
        type: 'options',
        default: '',
        required: true,
        typeOptions: { loadOptionsMethod: 'getTickets', loadOptionsDependsOn: ['eventSlug'] },
        displayOptions: { show: { resource: ['guest'] } },
        description:
          'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Guest Name',
        name: 'customerName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['guest'] } },
      },
      {
        displayName: 'Number of Guests',
        name: 'partySize',
        type: 'number',
        default: 1,
        typeOptions: { minValue: 1 },
        required: true,
        displayOptions: { show: { resource: ['guest'] } },
      },
      {
        displayName: 'Additional Fields',
        name: 'guestFields',
        type: 'collection',
        default: {},
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['guest'] } },
        options: [
          {
            displayName: 'Email',
            name: 'delivery_email',
            type: 'string',
            default: '',
            placeholder: 'name@example.com',
          },
          {
            displayName: 'Seat Names or IDs',
            name: 'event_place_ids',
            type: 'multiOptions',
            default: [],
            typeOptions: {
              loadOptionsMethod: 'getSeats',
              loadOptionsDependsOn: ['eventSlug', 'ticketId'],
            },
            description:
              'Choose available seats from the list, or specify IDs using an expression. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
          { displayName: 'Staff Note', name: 'staff_note', type: 'string', default: '' },
          {
            displayName: 'Standing Area Name or ID',
            name: 'event_capacity_pool_id',
            type: 'options',
            default: '',
            typeOptions: {
              loadOptionsMethod: 'getStandingAreas',
              loadOptionsDependsOn: ['eventSlug', 'ticketId'],
            },
            description:
              'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
        ],
      },
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['promoCode'] } },
      },
      {
        displayName: 'Discount Type',
        name: 'discountType',
        type: 'options',
        default: 'percentage',
        options: [
          { name: 'Percentage', value: 'percentage' },
          { name: 'Fixed Amount', value: 'fixed' },
        ],
        displayOptions: { show: { resource: ['promoCode'] } },
      },
      {
        displayName: 'Discount',
        name: 'discountAmount',
        type: 'number',
        default: 10,
        typeOptions: { minValue: 0 },
        displayOptions: { show: { resource: ['promoCode'] } },
      },
      {
        displayName: 'Additional Fields',
        name: 'promoFields',
        type: 'collection',
        default: {},
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['promoCode'] } },
        options: [
          { displayName: 'Expires At', name: 'expires_at', type: 'dateTime', default: '' },
          {
            displayName: 'Limit per Customer',
            name: 'max_per_customer',
            type: 'number',
            default: 1,
            typeOptions: { minValue: 1 },
          },
          {
            displayName: 'Usage Limit',
            name: 'usage_limit',
            type: 'number',
            default: 100,
            typeOptions: { minValue: 1 },
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getEvents(this: ILoadOptionsFunctions) {
        return (await events(this)).map((event) => ({ name: event.title, value: event.slug }));
      },
      async getVenues(this: ILoadOptionsFunctions) {
        return (
          await request<{ venues: Array<{ id: number; name: string }> }>(this, '/admin/venues')
        ).venues.map((venue) => ({ name: venue.name, value: venue.id }));
      },
      async getTickets(this: ILoadOptionsFunctions) {
        return (await tickets(this, this.getCurrentNodeParameter('eventSlug') as string)).map(
          (ticket) => ({ name: ticket.title, value: ticket.id }),
        );
      },
      async getSeats(this: ILoadOptionsFunctions) {
        const ticket = (
          await tickets(this, this.getCurrentNodeParameter('eventSlug') as string)
        ).find((ticket) => ticket.id === Number(this.getCurrentNodeParameter('ticketId')));
        return (ticket?.available_places || []).map((place) => ({
          name: place.label,
          value: place.id,
        }));
      },
      async getStandingAreas(this: ILoadOptionsFunctions) {
        const ticket = (
          await tickets(this, this.getCurrentNodeParameter('eventSlug') as string)
        ).find((ticket) => ticket.id === Number(this.getCurrentNodeParameter('ticketId')));
        return (ticket?.standing_areas || []).map((area) => ({ name: area.label, value: area.id }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const output: INodeExecutionData[] = [];
    for (let i = 0; i < this.getInputData().length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        const slug = encodeURIComponent(this.getNodeParameter('eventSlug', i, '') as string);
        const fields = (name: string) => this.getNodeParameter(name, i, {}) as IDataObject;
        const headers =
          operation === 'create'
            ? { 'Idempotency-Key': this.getNodeParameter('requestKey', i) as string }
            : {};
        let result: IDataObject | IDataObject[];
        if (resource === 'event' && operation === 'getAll') result = await events(this);
        else if (resource === 'event' && operation === 'get')
          result = await request(this, `/admin/events/${slug}`);
        else if (resource === 'event' && operation === 'create')
          result = await request(this, '/admin/events', {
            method: 'POST',
            headers,
            body: {
              event: {
                ...fields('eventFields'),
                title: this.getNodeParameter('title', i),
                venue_id: this.getNodeParameter('venueId', i),
                starts_at: this.getNodeParameter('startsAt', i),
                ends_at: this.getNodeParameter('endsAt', i),
              },
            },
          });
        else if (resource === 'event' && operation === 'update')
          result = await request(this, `/admin/events/${slug}`, {
            method: 'PATCH',
            body: { event: fields('eventFields') },
          });
        else if (resource === 'event' && ['publish', 'unpublish'].includes(operation)) {
          await request(this, `/admin/events/${slug}/publication`, {
            method: operation === 'publish' ? 'POST' : 'DELETE',
          });
          result = await request(this, `/admin/events/${slug}`);
        } else if (resource === 'order')
          result = await request(
            this,
            `/admin/orders/${encodeURIComponent(this.getNodeParameter('reference', i) as string)}`,
          );
        else if (resource === 'ticket') result = await tickets(this, decodeURIComponent(slug));
        else if (resource === 'guest')
          result = await request(this, `/admin/events/${slug}/guest_parties`, {
            method: 'POST',
            headers,
            body: {
              guest_party: {
                ...fields('guestFields'),
                ticket_id: this.getNodeParameter('ticketId', i),
                customer_name: this.getNodeParameter('customerName', i),
                party_size: this.getNodeParameter('partySize', i),
              },
            },
          });
        else if (resource === 'promoCode') {
          const event = await request(this, `/admin/events/${slug}`);
          result = await request(this, '/admin/promo_codes', {
            method: 'POST',
            headers,
            body: {
              promo_code: {
                ...fields('promoFields'),
                event_id: event.id,
                active: true,
                code: this.getNodeParameter('code', i),
                discount_type: this.getNodeParameter('discountType', i),
                discount_amount: String(this.getNodeParameter('discountAmount', i)),
              },
            },
          });
        } else
          throw new NodeOperationError(this.getNode(), 'Unsupported operation', { itemIndex: i });
        let records = Array.isArray(result) ? result : [result];
        if (operation === 'getAll' && !this.getNodeParameter('returnAll', i, false))
          records = records.slice(0, this.getNodeParameter('limit', i, 50) as number);
        output.push(...records.map((json) => ({ json, pairedItem: { item: i } })));
      } catch (error) {
        if (!this.continueOnFail()) throw new NodeApiError(this.getNode(), error as JsonObject);
        output.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
      }
    }
    return [output];
  }
}
