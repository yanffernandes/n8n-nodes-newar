import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { deleteRecord, getRecordId, recordLocator, updateDisplayOptions } from '../common';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Deal',
		name: 'dealId',
		searchListMethod: 'searchDeals',
		noun: 'deal',
		description: 'The deal to delete',
	}),
	{
		displayName:
			"A lead's primary deal can't be deleted on its own: delete the lead, or mark the deal as lost. Newar keeps deleted records, and its support can restore them.",
		name: 'deleteNotice',
		type: 'notice',
		default: '',
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['deal'], operation: ['delete'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'dealId', itemIndex, 'Deal');
	return await deleteRecord.call(this, itemIndex, `/v1/deals/${id}`);
}
