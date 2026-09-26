import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { applyOutput, flattenSearchHit, type OutputMode } from '../../helpers/output';
import { newarApiRequestAllItems, SEARCH_PAGE_SIZE } from '../../transport';
import {
	limitProperty,
	outputProperties,
	readPaging,
	returnAllProperty,
	updateDisplayOptions,
} from '../common';
import { readSearchTerm, searchTermProperty } from '../search/term';

const properties: INodeProperties[] = [
	searchTermProperty(
		'Text to look for in names, companies, emails and phones. Separate up to 10 values with commas, such as a name, an email and a phone, to find the leads that match any of them',
		2,
		'e.g. ana souza, ana@example.com, 11999990000',
	),
	{
		displayName: 'Exact Match',
		name: 'exactMatch',
		type: 'boolean',
		default: false,
		description: 'Whether to only return leads where a field is exactly the search term',
	},
	returnAllProperty(),
	limitProperty(1000),
	...outputProperties('lead'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['search'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const term = readSearchTerm(this, itemIndex, 2);
	const exactMatch = this.getNodeParameter('exactMatch', itemIndex, false) as boolean;
	const hits = await newarApiRequestAllItems.call(
		this,
		{
			path: '/v1/leads/search',
			qs: { term, ...(exactMatch ? { exact_match: 'true' } : {}) },
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
		flattenSearchHit(hit, (lead) => applyOutput(lead, 'lead', mode, fields)),
	);
}
