import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildBody } from '../../helpers/fields';
import {
	createRecord,
	getCollection,
	getRequiredText,
	idempotencyOptions,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';
import { customFieldsProperty, readCustomFields } from '../customFields';
import { LEAD_BODY_FIELDS, leadCreateFields } from './fields';

const properties: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Nathan Smith',
		description: "The lead's full name",
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: leadCreateFields,
	},
	customFieldsProperty('lead', 'create'),
	idempotencyOptions('lead'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['create'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const body: IDataObject = {
		name: getRequiredText(this, 'name', itemIndex, 'Name'),
		...buildBody(
			getCollection(this, 'additionalFields', itemIndex),
			LEAD_BODY_FIELDS,
			'create',
			context.timeZone,
		),
	};
	const customFields = readCustomFields(this, 'lead', 'create', itemIndex, context.timeZone);
	if (customFields) body.custom_fields = customFields;
	return await createRecord.call(this, itemIndex, context, '/v1/leads', body);
}
