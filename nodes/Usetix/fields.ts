import type { INodeProperties, INodeCredentialDescription } from 'n8n-workflow';

export const credentials: INodeCredentialDescription[] = [
  { name: 'usetixApi', required: true, displayOptions: { show: { authentication: ['apiToken'] } } },
  {
    name: 'usetixOAuth2Api',
    required: true,
    displayOptions: { show: { authentication: ['oAuth2'] } },
  },
];
export const authentication: INodeProperties = {
  displayName: 'Authentication',
  name: 'authentication',
  type: 'options',
  default: 'apiToken',
  options: [
    { name: 'API Token', value: 'apiToken' },
    { name: 'OAuth2', value: 'oAuth2' },
  ],
};
export const event: INodeProperties = {
  displayName: 'Event Name or ID',
  name: 'eventSlug',
  type: 'options',
  typeOptions: { loadOptionsMethod: 'getEvents' },
  default: '',
  required: true,
  description:
    'Choose from the list, or specify a slug using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};
export const requestKey: INodeProperties = {
  displayName: 'Unique Request Key',
  name: 'requestKey',
  type: 'string',
  default: '',
  required: true,
  description:
    'Map the source record or notification ID. Repeating the same key and input returns the original result for seven days.',
};
