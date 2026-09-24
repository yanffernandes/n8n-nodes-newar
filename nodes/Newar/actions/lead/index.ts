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
		displayOptions: { show: { resource: ['lead'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new lead, with the same automations as the Newar app',
				action: 'Create lead',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a lead and its deals',
				action: 'Delete lead',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a lead',
				action: 'Get lead',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of leads, with filters',
				action: 'Get many leads',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Find leads by name, company, email or phone',
				action: 'Search leads',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change fields, stage, owner, tags or custom fields of a lead',
				action: 'Update lead',
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
