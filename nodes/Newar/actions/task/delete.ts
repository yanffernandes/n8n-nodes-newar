import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { deleteRecord, getRecordId, recordLocator, updateDisplayOptions } from '../common';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Task',
		name: 'taskId',
		searchListMethod: 'searchTasks',
		noun: 'task',
		description: "The task to delete. The deletion is recorded on the lead's timeline.",
	}),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['task'], operation: ['delete'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'taskId', itemIndex, 'Task');
	return await deleteRecord.call(this, itemIndex, `/v1/tasks/${id}`);
}
