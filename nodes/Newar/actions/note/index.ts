import type { INodeProperties } from 'n8n-workflow';

import type { OperationHandler } from '../common';
import * as create from './create';
import * as get from './get';
import * as getAll from './getAll';

export const handlers: Record<string, OperationHandler> = {
	create: create.execute,
	get: get.execute,
	getAll: getAll.execute,
};

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['note'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: "Add a note to a lead's or a deal's timeline",
				action: 'Create note',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a note',
				action: 'Get note',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of notes, newest first',
				action: 'Get many notes',
			},
		],
		default: 'create',
	},
	...create.description,
	...get.description,
	...getAll.description,
];
