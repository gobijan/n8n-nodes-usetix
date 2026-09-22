import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class UsetixApi implements ICredentialType {
  name = 'usetixApi';
  displayName = 'Usetix API';
  documentationUrl = 'https://www.usetix.io/docs/api/';
  icon = 'file:../nodes/Usetix/usetix.svg' as const;
  properties: INodeProperties[] = [
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description:
        'Create a token in Usetix → Settings → API Tokens. Use write access for actions and triggers.',
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: { Authorization: '=Bearer {{$credentials.apiToken}}', Accept: 'application/json' },
    },
  };
  test: ICredentialTestRequest = {
    request: { baseURL: 'https://app.usetix.io', url: '/admin/identity', method: 'GET' },
  };
}
