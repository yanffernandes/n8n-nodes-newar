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
		displayName: 'Task',
		name: 'taskId',
		searchListMethod: 'searchTasks',
		noun: 'task',
		description: 'The task to retrieve',
	}),
	...outputProperties('task'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['task'], operation: ['get'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'taskId', itemIndex, 'Task');
	const task = await getRecord.call(this, itemIndex, `/v1/tasks/${id}`);
	return shapeRecords(this, itemIndex, 'task', [task])[0];
}
