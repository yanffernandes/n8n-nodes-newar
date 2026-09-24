import type { INodeProperties } from 'n8n-workflow';

import type { OperationHandler } from '../common';
import * as create from './create';
import * as remove from './delete';
import * as get from './get';
import * as getAll from './getAll';
import * as update from './update';

export const handlers: Record<string, OperationHandler> = {
	create: create.execute,
	delete: remove.execute,
	get: get.execute,
	getAll: getAll.execute,
	update: update.execute,
};

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new task for a lead, optionally on one of its deals',
				action: 'Create task',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a task',
				action: 'Delete task',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a task',
				action: 'Get task',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of tasks, with filters',
				action: 'Get many tasks',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Complete, cancel, reopen or edit a task',
				action: 'Update task',
			},
		],
		default: 'create',
	},
	...create.description,
	...remove.description,
	...get.description,
	...getAll.description,
	...update.description,
];
