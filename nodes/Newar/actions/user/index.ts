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
		displayOptions: { show: { resource: ['user'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a member of the workspace',
				action: 'Get user',
			},
			{
				name: 'Get Current',
				value: 'getCurrent',
				description:
					"Retrieve the token's user, workspace, scope (read or read-write) and role permissions",
				action: 'Get current user and token',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve the members of the workspace',
				action: 'Get many users',
			},
		],
		default: 'getAll',
	},
	...updateDisplayOptions({ show: { resource: ['user'], operation: ['get'] } }, [
		recordLocator({
			displayName: 'User',
			name: 'userId',
			searchListMethod: 'searchUsers',
			noun: 'user',
			description: 'The user to retrieve',
		}),
	]),
	...updateDisplayOptions({ show: { resource: ['user'], operation: ['getAll'] } }, [
		returnAllProperty(),
		limitProperty(1000),
	]),
];

async function get(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const id = getRecordId(this, 'userId', itemIndex, 'User');
	return await getRecord.call(this, itemIndex, `/v1/users/${id}`);
}

async function getCurrent(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	return await getRecord.call(this, itemIndex, '/v1/me');
}

async function getAll(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/users',
		itemIndex,
	});
	return applyLimit(this, itemIndex, (response.data as IDataObject[] | undefined) ?? []);
}

export const handlers: Record<string, OperationHandler> = { get, getAll, getCurrent };
