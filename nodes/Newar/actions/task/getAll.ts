import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildQuery } from '../../helpers/fields';
import { newarApiRequestAllItems } from '../../transport';
import {
	getCollectionWithUserIds,
	limitProperty,
	outputProperties,
	readPaging,
	readSort,
	returnAllProperty,
	shapeRecords,
	sortProperty,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';
import { TASK_FILTERS, TASK_KIND_OPTIONS, TASK_STATUS_OPTIONS } from './fields';

const properties: INodeProperties[] = [
	returnAllProperty(),
	limitProperty(1000),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		options: [
			{
				displayName: 'Assignee Email, Name or ID',
				name: 'assignedToId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
				description:
					'Only tasks of this user. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Deal ID',
				name: 'dealId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				description: 'Only tasks of this deal',
			},
			{
				displayName: 'Due Before',
				name: 'dueUntil',
				type: 'dateTime',
				default: '',
				description: 'Only tasks due before this moment',
			},
			{
				displayName: 'Due Since',
				name: 'dueSince',
				type: 'dateTime',
				default: '',
				description: 'Only tasks due at or after this moment',
			},
			{
				displayName: 'IDs',
				name: 'ids',
				type: 'string',
				default: '',
				placeholder:
					'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d,7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d',
				description: 'Only these tasks. Up to 100 IDs, separated by commas.',
			},
			{
				displayName: 'Lead ID',
				name: 'leadId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				description: 'Only tasks of this lead',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: TASK_STATUS_OPTIONS,
				default: [],
				description: 'Only tasks with one of these statuses',
			},
			{
				displayName: 'Type',
				name: 'kind',
				type: 'multiOptions',
				options: TASK_KIND_OPTIONS,
				default: [],
				description: 'Only tasks of these types',
			},
			{
				displayName: 'Updated Before',
				name: 'updatedUntil',
				type: 'dateTime',
				default: '',
				description: 'Only tasks last changed before this moment',
			},
			{
				displayName: 'Updated Since',
				name: 'updatedSince',
				type: 'dateTime',
				default: '',
				description: 'Only tasks changed at or after this moment',
			},
		],
	},
	sortProperty(
		[
			{ name: 'Created At', value: 'created_at' },
			{ name: 'Due Date', value: 'due_at' },
			{ name: 'Updated At', value: 'updated_at' },
		],
		'created_at',
	),
	...outputProperties('task'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['task'], operation: ['getAll'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const filters = await getCollectionWithUserIds(this, 'filters', itemIndex, context);
	const qs = {
		...buildQuery(filters, TASK_FILTERS, context.timeZone),
		...readSort(this, itemIndex),
	};
	const tasks = await newarApiRequestAllItems.call(
		this,
		{ path: '/v1/tasks', qs, itemIndex },
		readPaging(this, itemIndex),
	);
	return shapeRecords(this, itemIndex, 'task', tasks);
}
