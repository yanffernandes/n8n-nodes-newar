import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildQuery, type QueryField } from '../../helpers/fields';
import { applyOutput, flattenSearchHit, type OutputMode } from '../../helpers/output';
import { newarApiRequestAllItems, SEARCH_PAGE_SIZE } from '../../transport';
import {
	getCollection,
	limitProperty,
	outputProperties,
	readPaging,
	returnAllProperty,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';
import { readSearchTerm, searchTermProperty } from '../search/term';
import { DEAL_STATUS_OPTIONS } from './fields';

const SEARCH_FILTERS: QueryField[] = [
	{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' },
	{ param: 'status', api: 'status', kind: 'csv', label: 'Status' },
];

const properties: INodeProperties[] = [
	searchTermProperty('Text to look for in titles, next steps and observations', 2),
	{
		displayName: 'Exact Match',
		name: 'exactMatch',
		type: 'boolean',
		default: false,
		description: 'Whether to only return deals where a field is exactly the search term',
	},
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
				displayName: 'Lead ID',
				name: 'leadId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				description: 'Only deals of this lead',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: DEAL_STATUS_OPTIONS,
				default: [],
				description: 'Only deals with one of these statuses',
			},
		],
	},
	...outputProperties('deal'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['deal'], operation: ['search'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const term = readSearchTerm(this, itemIndex, 2);
	const exactMatch = this.getNodeParameter('exactMatch', itemIndex, false) as boolean;
	const filters = buildQuery(
		getCollection(this, 'filters', itemIndex),
		SEARCH_FILTERS,
		context.timeZone,
	);
	const hits = await newarApiRequestAllItems.call(
		this,
		{
			path: '/v1/deals/search',
			qs: { term, ...(exactMatch ? { exact_match: 'true' } : {}), ...filters },
			itemIndex,
			maxPageSize: SEARCH_PAGE_SIZE,
			itemsAt: 'data.items',
		},
		readPaging(this, itemIndex),
	);
	const mode = this.getNodeParameter('output', itemIndex, 'simplified') as OutputMode;
	const fields =
		mode === 'fields' ? (this.getNodeParameter('fields', itemIndex, []) as string[]) : [];
	return hits.map((hit) =>
		flattenSearchHit(hit, (deal) => applyOutput(deal, 'deal', mode, fields)),
	);
}
