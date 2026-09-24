import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { flattenSearchHit } from '../../helpers/output';
import { newarApiRequest } from '../../transport';
import { updateDisplayOptions, type OperationHandler } from '../common';
import { readSearchTerm, searchTermProperty } from './term';

const RECORD_TYPES = ['deal', 'lead', 'task'];

const properties: INodeProperties[] = [
	searchTermProperty(
		'Text to look for in lead names, deal titles and task titles, like the search bar of the Newar app',
		3,
	),
	{
		displayName: 'Record Types',
		name: 'recordTypes',
		type: 'multiOptions',
		options: [
			{ name: 'Deal', value: 'deal' },
			{ name: 'Lead', value: 'lead' },
			{ name: 'Task', value: 'task' },
		],
		default: ['deal', 'lead', 'task'],
		description: 'Types of record to search. Types your Newar user cannot see are skipped.',
	},
	{
		displayName: 'Limit per Type',
		name: 'limitPerType',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 30 },
		default: 10,
		description: 'Max number of results to return for each record type',
	},
];

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['search'] } },
		options: [
			{
				name: 'Search Records',
				value: 'search',
				description: 'Search leads, deals and tasks at once, ordered by relevance',
				action: 'Search all records',
			},
		],
		default: 'search',
	},
	...updateDisplayOptions({ show: { resource: ['search'], operation: ['search'] } }, properties),
];

async function searchRecords(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const term = readSearchTerm(this, itemIndex, 3);
	const selected =
		(this.getNodeParameter('recordTypes', itemIndex, RECORD_TYPES) as string[]) ?? [];
	const recordTypes = selected.filter((type) => RECORD_TYPES.includes(type));
	if (recordTypes.length === 0) {
		throw new NodeOperationError(this.getNode(), "Choose at least one of the 'Record Types'", {
			itemIndex,
		});
	}
	const limit = this.getNodeParameter('limitPerType', itemIndex, 10) as number;
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/search',
		qs: { term, item_types: recordTypes.join(','), limit },
		itemIndex,
	});
	const hits = (response.data as { items?: IDataObject[] } | undefined)?.items ?? [];
	return hits.map((hit) => ({ type: hit.type, ...flattenSearchHit(hit) }));
}

export const handlers: Record<string, OperationHandler> = {
	search: searchRecords,
};
