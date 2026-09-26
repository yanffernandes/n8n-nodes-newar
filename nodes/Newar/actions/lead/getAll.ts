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
import { LEAD_FILTERS } from './fields';

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
				description: 'Only these leads. Up to 100 IDs, separated by commas.',
			},
			{
				displayName: 'Owner Email, Name or ID',
				name: 'ownerId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
				description:
					'Only leads of this owner. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Pipeline Name or ID',
				name: 'pipelineId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPipelines' },
				default: '',
				description:
					'Only leads in stages of this pipeline. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Source',
				name: 'source',
				type: 'string',
				default: '',
				placeholder: 'e.g. website',
				description: 'Only leads from this source',
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
					'Only leads in this stage. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Tag Name or ID',
				name: 'tagId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLeadTags' },
				default: '',
				description:
					'Only leads with this tag. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Updated Before',
				name: 'updatedUntil',
				type: 'dateTime',
				default: '',
				description: 'Only leads last changed before this moment',
			},
			{
				displayName: 'Updated Since',
				name: 'updatedSince',
				type: 'dateTime',
				default: '',
				description: 'Only leads changed at or after this moment',
			},
		],
	},
	sortProperty(
		[
			{ name: 'Created At', value: 'created_at' },
			{ name: 'Name', value: 'name' },
			{ name: 'Updated At', value: 'updated_at' },
		],
		'created_at',
	),
	...outputProperties('lead'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['getAll'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const filters = await getCollectionWithUserIds(this, 'filters', itemIndex, context);
	const qs = {
		...buildQuery(filters, LEAD_FILTERS, context.timeZone),
		...readSort(this, itemIndex),
	};
	const leads = await newarApiRequestAllItems.call(
		this,
		{ path: '/v1/leads', qs, itemIndex },
		readPaging(this, itemIndex),
	);
	return shapeRecords(this, itemIndex, 'lead', leads);
}
