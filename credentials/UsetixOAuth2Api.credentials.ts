import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class UsetixOAuth2Api implements ICredentialType {
  name = 'usetixOAuth2Api';
  extends = ['oAuth2Api'];
  displayName = 'Usetix OAuth2 API';
  documentationUrl = 'https://www.usetix.io/docs/api/';
  icon = 'file:../nodes/Usetix/usetix.svg' as const;
  properties: INodeProperties[] = [
    { displayName: 'Grant Type', name: 'grantType', type: 'hidden', default: 'pkce' },
    {
      displayName: 'Authorization URL',
      name: 'authUrl',
      type: 'hidden',
      default: 'https://app.usetix.io/oauth/authorize',
    },
    {
      displayName: 'Access Token URL',
      name: 'accessTokenUrl',
      type: 'hidden',
      default: 'https://app.usetix.io/oauth/token',
    },
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'hidden',
      default: 'api:read api:write webhooks:write',
    },
    {
      displayName: 'Auth URI Query Parameters',
      name: 'authQueryParameters',
      type: 'hidden',
      default: 'resource=https%3A%2F%2Fapp.usetix.io%2Fadmin',
    },
    { displayName: 'Authentication', name: 'authentication', type: 'hidden', default: 'body' },
  ];
}
