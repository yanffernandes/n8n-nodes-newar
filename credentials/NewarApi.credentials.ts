import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NewarApi implements ICredentialType {
	name = 'newarApi';

	displayName = 'Newar API';

	icon: Icon = { light: 'file:../icons/newar.svg', dark: 'file:../icons/newar.dark.svg' };

	documentationUrl = 'https://github.com/yanffernandes/n8n-nodes-newar#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			hint: 'Create it in Newar under Settings > API. Read-only tokens start with nw_r_, read-write tokens with nw_rw_.',
			description:
				'The token acts as the Newar user who created it, with the same permissions. Creating, updating and deleting need a read-write token.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.newar.com.br/functions/v1/api',
			description: 'Address of the Newar API. Change it only to test against another environment.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken.trim()}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{($credentials.baseUrl || "https://api.newar.com.br/functions/v1/api").replace(/\\/+$/, "")}}',
			url: '/v1/me',
			method: 'GET',
		},
	};
}
