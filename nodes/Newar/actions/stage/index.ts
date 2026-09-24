import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { newarApiRequest } from '../../transport';
import {
	applyLimit,
	getCollection,
	getRecord,
	getRecordId,
	limitProperty,
	recordLocator,
	returnAllProperty,
	updateDisplayOptions,
	type OperationHandler,
} from '../common';
import { isUuid } from '../../helpers/fields';

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['stage'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a pipeline stage',
				action: 'Get stage',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve the stages of every pipeline, or of one pipeline, in order',
				action: 'Get many stages',
			},
		],
		default: 'getAll',
	},
	...updateDisplayOptions({ show: { resource: ['stage'], operation: ['get'] } }, [
		recordLocator({
			displayName: 'Stage',
			name: 'stageId',
			searchListMethod: 'searchStages',
			noun: 'stage',
			description: 'The stage to retrieve',
		}),
	]),
	...updateDisplayOptions({ show: { resource: ['stage'], operation: ['getAll'] } }, [
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
					displayName: 'Pipeline Name or ID',
					name: 'pipelineId',
					type: 'options',
					typeOptions: { loadOptionsMethod: 'getPipelines' },
					default: '',
					description:
						'Only stages of this pipeline. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				},
			],
		},
	]),
];

async function get(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'stageId', itemIndex, 'Stage');
	return await getRecord.call(this, itemIndex, `/v1/stages/${id}`);
}

async function getAll(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const { pipelineId } = getCollection(this, 'filters', itemIndex);
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/stages',
		qs: isUuid(pipelineId) ? { pipeline_id: pipelineId.trim() } : undefined,
		itemIndex,
	});
	return applyLimit(this, itemIndex, (response.data as IDataObject[] | undefined) ?? []);
}

export const handlers: Record<string, OperationHandler> = { get, getAll };
