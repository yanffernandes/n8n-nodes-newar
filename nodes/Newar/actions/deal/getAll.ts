import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildQuery } from '../../helpers/fields';
import { newarApiRequestAllItems } from '../../transport';
import {
	getCollection,
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
import { DEAL_FILTERS, DEAL_STATUS_OPTIONS } from './fields';

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
				displayName: 'IDs',
				name: 'ids',
				type: 'string',
				default: '',
				placeholder:
					'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d,7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d',
				description: 'Only these deals. Up to 100 IDs, separated by commas.',
			},
			{
				displayName: 'Lead ID',
				name: 'leadId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				description: 'Only deals of this lead',
			},
			{
				displayName: 'Owner Name or ID',
				name: 'ownerId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
				description:
					'Only deals of this owner. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Pipeline Name or ID',
				name: 'pipelineId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPipelines' },
				default: '',
				description:
					'Only deals in this pipeline. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Stage Name or ID',
				name: 'stageId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getStages',
					loadOptionsDependsOn: ['filters.pipelineId'],
				},
				default: '',
				description:
					'Only deals in this stage. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: DEAL_STATUS_OPTIONS,
				default: [],
				description: 'Only deals with one of these statuses',
			},
			{
				displayName: 'Updated Before',
				name: 'updatedUntil',
				type: 'dateTime',
				default: '',
				description: 'Only deals last changed before this moment',
			},
			{
				displayName: 'Updated Since',
				name: 'updatedSince',
				type: 'dateTime',
				default: '',
				description: 'Only deals changed at or after this moment',
			},
		],
	},
	sortProperty(
		[
			{ name: 'Created At', value: 'created_at' },
			{ name: 'Title', value: 'title' },
			{ name: 'Updated At', value: 'updated_at' },
		],
		'created_at',
	),
	...outputProperties('deal'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['deal'], operation: ['getAll'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const qs = {
		...buildQuery(getCollection(this, 'filters', itemIndex), DEAL_FILTERS, context.timeZone),
		...readSort(this, itemIndex),
	};
	const deals = await newarApiRequestAllItems.call(
		this,
		{ path: '/v1/deals', qs, itemIndex },
		readPaging(this, itemIndex),
	);
	return shapeRecords(this, itemIndex, 'deal', deals);
}
