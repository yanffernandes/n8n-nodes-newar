import type { INodeProperties } from 'n8n-workflow';

import type { OperationHandler } from '../common';
import * as create from './create';
import * as remove from './delete';
import * as get from './get';
import * as getAll from './getAll';
import * as search from './search';
import * as update from './update';

export const handlers: Record<string, OperationHandler> = {
	create: create.execute,
	delete: remove.execute,
	get: get.execute,
	getAll: getAll.execute,
	search: search.execute,
	update: update.execute,
};

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['deal'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new deal for an existing lead',
				action: 'Create deal',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a deal',
				action: 'Delete deal',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a deal',
				action: 'Get deal',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of deals, with filters',
				action: 'Get many deals',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Find deals by title, next step or observations',
				action: 'Search deals',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Move, win, lose, reopen or edit a deal',
				action: 'Update deal',
			},
		],
		default: 'create',
	},
	...create.description,
	...remove.description,
	...get.description,
	...getAll.description,
	...search.description,
	...update.description,
];
