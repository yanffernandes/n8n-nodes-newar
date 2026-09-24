import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import {
	getRecord,
	getRecordId,
	outputProperties,
	recordLocator,
	shapeRecords,
	updateDisplayOptions,
} from '../common';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Deal',
		name: 'dealId',
		searchListMethod: 'searchDeals',
		noun: 'deal',
		description: 'The deal to retrieve',
	}),
	...outputProperties('deal'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['deal'], operation: ['get'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'dealId', itemIndex, 'Deal');
	const deal = await getRecord.call(this, itemIndex, `/v1/deals/${id}`);
	return shapeRecords(this, itemIndex, 'deal', [deal])[0];
}
