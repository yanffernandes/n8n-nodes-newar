import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { newarApiRequest } from '../../transport';
import {
	applyLimit,
	createRecord,
	deleteRecord,
	getCollection,
	getRecordId,
	getRequiredText,
	idempotencyOptions,
	limitProperty,
	recordLocator,
	returnAllProperty,
	updateDisplayOptions,
	updateRecord,
	type ExecutionContext,
	type OperationHandler,
} from '../common';

const RECORD_TYPE_OPTIONS = [
	{ name: 'Deal', value: 'deal' },
	{ name: 'Lead', value: 'lead' },
];

function tagLocator(description: string): INodeProperties {
	return recordLocator({
		displayName: 'Tag',
		name: 'tagId',
		searchListMethod: 'searchTags',
		noun: 'tag',
		description,
	});
}

const createProperties: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Full scholarship',
		description: 'Name of the tag, up to 40 characters. It must be unique for its record type.',
	},
	{
		displayName: 'Record Type',
		name: 'entity',
		type: 'options',
		options: RECORD_TYPE_OPTIONS,
		default: 'lead',
		description: 'Whether the tag marks leads or deals',
	},
	idempotencyOptions('tag'),
];

const deleteProperties: INodeProperties[] = [
	tagLocator('The tag to delete'),
	{
		displayName:
			'Only workspace owners and admins can delete tags, and only tags that no record uses, including deleted records.',
		name: 'deleteNotice',
		type: 'notice',
		default: '',
	},
];

const getAllProperties: INodeProperties[] = [
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
				displayName: 'Record Type',
				name: 'entity',
				type: 'options',
				options: RECORD_TYPE_OPTIONS,
				default: 'lead',
				description: 'Only tags of this record type',
			},
		],
	},
];

const updateProperties: INodeProperties[] = [
	tagLocator('The tag to rename. Only workspace owners and admins can rename tags.'),
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Full scholarship',
		description: 'New name of the tag, up to 40 characters',
	},
];

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tag'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new tag for leads or deals',
				action: 'Create tag',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a tag that no record uses',
				action: 'Delete tag',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of tags, with how many records use each one',
				action: 'Get many tags',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Rename a tag',
				action: 'Update tag',
			},
		],
		default: 'create',
	},
	...updateDisplayOptions({ show: { resource: ['tag'], operation: ['create'] } }, createProperties),
	...updateDisplayOptions({ show: { resource: ['tag'], operation: ['delete'] } }, deleteProperties),
	...updateDisplayOptions({ show: { resource: ['tag'], operation: ['getAll'] } }, getAllProperties),
	...updateDisplayOptions({ show: { resource: ['tag'], operation: ['update'] } }, updateProperties),
];

async function create(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const body: IDataObject = {
		name: getRequiredText(this, 'name', itemIndex, 'Name').trim(),
		entity: this.getNodeParameter('entity', itemIndex, 'lead') as string,
	};
	return await createRecord.call(this, itemIndex, context, '/v1/tags', body);
}

async function remove(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'tagId', itemIndex, 'Tag');
	return await deleteRecord.call(this, itemIndex, `/v1/tags/${id}`);
}

async function getAll(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const filters = getCollection(this, 'filters', itemIndex);
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/tags',
		qs: { entity: filters.entity },
		itemIndex,
	});
	return applyLimit(this, itemIndex, (response.data as IDataObject[] | undefined) ?? []);
}

async function update(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'tagId', itemIndex, 'Tag');
	const name = getRequiredText(this, 'name', itemIndex, 'Name').trim();
	return await updateRecord.call(this, itemIndex, `/v1/tags/${id}`, { name });
}

export const handlers: Record<string, OperationHandler> = {
	create,
	delete: remove,
	getAll,
	update,
};
