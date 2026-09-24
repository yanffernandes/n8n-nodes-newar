import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { newarApiRequest } from '../../transport';
import {
	applyLimit,
	limitProperty,
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
		displayOptions: { show: { resource: ['lossReason'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve the reasons a deal can be lost for',
				action: 'Get many loss reasons',
			},
		],
		default: 'getAll',
	},
	...updateDisplayOptions({ show: { resource: ['lossReason'], operation: ['getAll'] } }, [
		returnAllProperty(),
		limitProperty(1000),
	]),
];

async function getAll(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/loss-reasons',
		itemIndex,
	});
	return applyLimit(this, itemIndex, (response.data as IDataObject[] | undefined) ?? []);
}

export const handlers: Record<string, OperationHandler> = { getAll };
