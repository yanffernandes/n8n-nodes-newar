import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { deleteRecord, getRecordId, recordLocator, updateDisplayOptions } from '../common';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Lead',
		name: 'leadId',
		searchListMethod: 'searchLeads',
		noun: 'lead',
		description: 'The lead to delete',
	}),
	{
		displayName:
			"Deleting a lead also deletes its deals. Newar keeps deleted records, and Newar's support can restore them.",
		name: 'deleteNotice',
		type: 'notice',
		default: '',
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['delete'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'leadId', itemIndex, 'Lead');
	return await deleteRecord.call(this, itemIndex, `/v1/leads/${id}`);
}
