import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildBody } from '../../helpers/fields';
import {
	getCollection,
	getRecordId,
	recordLocator,
	updateDisplayOptions,
	updateRecord,
	type ExecutionContext,
} from '../common';
import { TASK_BODY_FIELDS, taskUpdateFields } from './fields';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Task',
		name: 'taskId',
		searchListMethod: 'searchTasks',
		noun: 'task',
		description: 'The task to update',
	}),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: taskUpdateFields,
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['task'], operation: ['update'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const id = getRecordId(this, 'taskId', itemIndex, 'Task');
	const body = buildBody(
		getCollection(this, 'updateFields', itemIndex),
		TASK_BODY_FIELDS,
		'update',
		context.timeZone,
	);
	return await updateRecord.call(this, itemIndex, `/v1/tasks/${id}`, body);
}
