import {
  NodeApiError,
  type IDataObject,
  type IExecuteFunctions,
  type IHookFunctions,
  type ILoadOptionsFunctions,
  type IWebhookFunctions,
  type IHttpRequestOptions,
  type JsonObject,
} from 'n8n-workflow';

export type Context =
  | IExecuteFunctions
  | IHookFunctions
  | ILoadOptionsFunctions
  | IWebhookFunctions;
export type Event = IDataObject & { id: number; slug: string; title: string };
export type Ticket = IDataObject & {
  id: number;
  title: string;
  standing_areas: Place[];
  available_places: Place[];
};
type Place = IDataObject & { id: number; label: string };

export async function request<T = IDataObject>(
  context: Context,
  path: string,
  options: Partial<IHttpRequestOptions> = {},
): Promise<T> {
  if (!path.startsWith('/admin/') || path.includes('..') || path.includes('\\'))
    throw new Error('Only Usetix organizer API paths are supported.');
  const credential =
    context.getNodeParameter('authentication', 0) === 'oAuth2' ? 'usetixOAuth2Api' : 'usetixApi';
  try {
    return (await context.helpers.httpRequestWithAuthentication.call(context, credential, {
      method: 'GET',
      ...options,
      url: `https://app.usetix.io${path}`,
      headers: { Accept: 'application/json', ...options.headers },
      json: true,
    })) as T;
  } catch (error) {
    throw new NodeApiError(context.getNode(), error as JsonObject);
  }
}

export async function events(context: Context): Promise<Event[]> {
  const result = await request<{ upcoming_events: Event[]; past_events: Event[] }>(
    context,
    '/admin/events',
  );
  return [...result.upcoming_events, ...result.past_events];
}

export async function tickets(context: Context, slug: string): Promise<Ticket[]> {
  const result = await request<{ ticket_options: Ticket[] }>(
    context,
    `/admin/events/${encodeURIComponent(slug)}/guest_list`,
  );
  return result.ticket_options;
}

export function matchesEvent(notification: IDataObject, slug: string): boolean {
  if (!slug) return true;
  const record = notification.eventable as IDataObject;
  return (
    record.slug === slug ||
    record.event_slug === slug ||
    ((record.items || []) as IDataObject[]).some((item) => item.event_slug === slug)
  );
}
