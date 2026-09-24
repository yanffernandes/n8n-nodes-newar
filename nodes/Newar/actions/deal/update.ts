import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { buildBody } from '../../helpers/fields';
import {
	getCollection,
	getRecordId,
	recordLocator,
	updateDisplayOptions,
	updateRecord,
	type ExecutionContext,
} from '../common';
import { customFieldsProperty, readCustomFields } from '../customFields';
import { DEAL_BODY_FIELDS, dealUpdateFields } from './fields';

const properties: INodeProperties[] = [
	recordLocator({
		displayName: 'Deal',
		name: 'dealId',
		searchListMethod: 'searchDeals',
		noun: 'deal',
		description: 'The deal to update',
	}),
	{
		displayName:
			"A lead's primary deal ('is_primary') mirrors the lead: change its title, value, owner and next step with Lead > Update.",
		name: 'primaryDealNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: dealUpdateFields,
	},
	customFieldsProperty('deal', 'update'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['deal'], operation: ['update'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const id = getRecordId(this, 'dealId', itemIndex, 'Deal');
	const body = buildBody(
		getCollection(this, 'updateFields', itemIndex),
		DEAL_BODY_FIELDS,
		'update',
		context.timeZone,
	);
	const customFields = readCustomFields(this, 'deal', 'update', itemIndex, context.timeZone);
	if (customFields) body.custom_fields = customFields;
	return await updateRecord.call(this, itemIndex, `/v1/deals/${id}`, body);
}
