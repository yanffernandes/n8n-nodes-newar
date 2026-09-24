import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildQuery, type QueryField } from '../../helpers/fields';
import { newarApiRequestAllItems } from '../../transport';
import {
	getCollection,
	limitProperty,
	readPaging,
	returnAllProperty,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';

const NOTE_FILTERS: QueryField[] = [
	{ param: 'dealId', api: 'deal_id', kind: 'id', label: 'Deal ID' },
	{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' },
];

const properties: INodeProperties[] = [
	returnAllProperty(),
	limitProperty(1000),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		options: [
			{
				displayName: 'Deal ID',
				name: 'dealId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				description: 'Only notes of this deal',
			},
			{
				displayName: 'Lead ID',
				name: 'leadId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				description: "Only notes of this lead, including the notes of the lead's deals",
			},
		],
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['note'], operation: ['getAll'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const qs = buildQuery(getCollection(this, 'filters', itemIndex), NOTE_FILTERS, context.timeZone);
	return await newarApiRequestAllItems.call(
		this,
		{ path: '/v1/notes', qs, itemIndex },
		readPaging(this, itemIndex),
	);
}
