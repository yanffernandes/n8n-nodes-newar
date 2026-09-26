import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildBody } from '../../helpers/fields';
import {
	createRecord,
	getCollectionWithUserIds,
	getRecordId,
	getRequiredText,
	idempotencyOptions,
	recordLocator,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';
import { TASK_BODY_FIELDS, taskCreateFields } from './fields';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Lead',
		name: 'leadId',
		searchListMethod: 'searchLeads',
		noun: 'lead',
		description: 'The lead the task is about. It cannot change later.',
	}),
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Call to confirm the visit',
		description: 'Title of the task',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: taskCreateFields,
	},
	idempotencyOptions('task'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['task'], operation: ['create'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const body: IDataObject = {
		lead_id: getRecordId(this, 'leadId', itemIndex, 'Lead'),
		title: getRequiredText(this, 'title', itemIndex, 'Title'),
		...buildBody(
			await getCollectionWithUserIds(this, 'additionalFields', itemIndex, context),
			TASK_BODY_FIELDS,
			'create',
			context.timeZone,
		),
	};
	return await createRecord.call(this, itemIndex, context, '/v1/tasks', body);
}
