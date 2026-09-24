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
		displayName: 'Lead',
		name: 'leadId',
		searchListMethod: 'searchLeads',
		noun: 'lead',
		description: 'The lead to retrieve',
	}),
	...outputProperties('lead'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['get'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'leadId', itemIndex, 'Lead');
	const lead = await getRecord.call(this, itemIndex, `/v1/leads/${id}`);
	return shapeRecords(this, itemIndex, 'lead', [lead])[0];
}
