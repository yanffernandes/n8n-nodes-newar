import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildBody } from '../../helpers/fields';
import {
	createRecord,
	getCollectionWithUserIds,
	getRecordId,
	idempotencyOptions,
	recordLocator,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';
import { customFieldsProperty, readCustomFields } from '../customFields';
import { DEAL_BODY_FIELDS, dealCreateFields } from './fields';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Lead',
		name: 'leadId',
		searchListMethod: 'searchLeads',
		noun: 'lead',
		description: 'The lead (contact) the deal belongs to',
	}),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: dealCreateFields,
	},
	customFieldsProperty('deal', 'create'),
	idempotencyOptions('deal'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['deal'], operation: ['create'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const body: IDataObject = {
		lead_id: getRecordId(this, 'leadId', itemIndex, 'Lead'),
		...buildBody(
			await getCollectionWithUserIds(this, 'additionalFields', itemIndex, context),
			DEAL_BODY_FIELDS,
			'create',
			context.timeZone,
		),
	};
	const customFields = readCustomFields(this, 'deal', 'create', itemIndex, context.timeZone);
	if (customFields) body.custom_fields = customFields;
	return await createRecord.call(this, itemIndex, context, '/v1/deals', body);
}
