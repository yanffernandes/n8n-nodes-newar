import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { getRecord, getRecordId, recordLocator, updateDisplayOptions } from '../common';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Note',
		name: 'noteId',
		searchListMethod: 'searchNotes',
		noun: 'note',
		description: 'The note to retrieve. Deal notes need the Pipeline permission.',
	}),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['note'], operation: ['get'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'noteId', itemIndex, 'Note');
	return await getRecord.call(this, itemIndex, `/v1/notes/${id}`);
}
