import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildBody } from '../../helpers/fields';
import {
	getCollectionWithUserIds,
	getRecordId,
	recordLocator,
	updateDisplayOptions,
	updateRecord,
	type ExecutionContext,
} from '../common';
import { customFieldsProperty, readCustomFields } from '../customFields';
import { LEAD_BODY_FIELDS, leadUpdateFields } from './fields';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Lead',
		name: 'leadId',
		searchListMethod: 'searchLeads',
		noun: 'lead',
		description: 'The lead to update',
	}),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: leadUpdateFields,
	},
	customFieldsProperty('lead', 'update'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['update'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const id = getRecordId(this, 'leadId', itemIndex, 'Lead');
	const body = buildBody(
		await getCollectionWithUserIds(this, 'updateFields', itemIndex, context),
		LEAD_BODY_FIELDS,
		'update',
		context.timeZone,
	);
	const customFields = readCustomFields(this, 'lead', 'update', itemIndex, context.timeZone);
	if (customFields) body.custom_fields = customFields;
	return await updateRecord.call(this, itemIndex, `/v1/leads/${id}`, body);
}
