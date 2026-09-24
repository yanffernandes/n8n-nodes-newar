import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { newarApiRequest } from '../../transport';
import {
	applyLimit,
	getRecord,
	getRecordId,
	limitProperty,
	recordLocator,
	returnAllProperty,
	updateDisplayOptions,
	type OperationHandler,
} from '../common';

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['pipeline'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a pipeline with its stages',
				action: 'Get pipeline',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve the pipelines of the workspace, each with its stages in order',
				action: 'Get many pipelines',
			},
		],
		default: 'getAll',
	},
	...updateDisplayOptions({ show: { resource: ['pipeline'], operation: ['get'] } }, [
		recordLocator({
			displayName: 'Pipeline',
			name: 'pipelineId',
			searchListMethod: 'searchPipelines',
			noun: 'pipeline',
			description: 'The pipeline to retrieve',
		}),
	]),
	...updateDisplayOptions({ show: { resource: ['pipeline'], operation: ['getAll'] } }, [
		returnAllProperty(),
		limitProperty(1000),
	]),
];

async function get(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'pipelineId', itemIndex, 'Pipeline');
	return await getRecord.call(this, itemIndex, `/v1/pipelines/${id}`);
}

async function getAll(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/pipelines',
		itemIndex,
	});
	return applyLimit(this, itemIndex, (response.data as IDataObject[] | undefined) ?? []);
}

export const handlers: Record<string, OperationHandler> = { get, getAll };
