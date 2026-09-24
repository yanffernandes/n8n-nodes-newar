import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { newarApiRequest } from '../../transport';
import {
	applyLimit,
	limitProperty,
	returnAllProperty,
	updateDisplayOptions,
	type OperationHandler,
} from '../common';

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customField'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Retrieve the custom fields of leads or deals, with their keys, types and options',
				action: 'Get many custom fields',
			},
		],
		default: 'getAll',
	},
	...updateDisplayOptions({ show: { resource: ['customField'], operation: ['getAll'] } }, [
		{
			displayName: 'Record Type',
			name: 'entity',
			type: 'options',
			options: [
				{ name: 'Deal', value: 'deal' },
				{ name: 'Lead', value: 'lead' },
			],
			default: 'lead',
			description: 'Whether to list the custom fields of leads or of deals',
		},
		returnAllProperty(),
		limitProperty(1000),
	]),
];

async function getAll(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const entity = this.getNodeParameter('entity', itemIndex, 'lead') as string;
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: entity === 'deal' ? '/v1/deal-fields' : '/v1/lead-fields',
		itemIndex,
	});
	return applyLimit(this, itemIndex, (response.data as IDataObject[] | undefined) ?? []);
}

export const handlers: Record<string, OperationHandler> = { getAll };
