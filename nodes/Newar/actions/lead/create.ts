import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { contactExistsFromError } from '../../helpers/errors';
import { buildBody } from '../../helpers/fields';
import {
	createRecord,
	getCollectionWithUserIds,
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
		displayName: 'If Lead Already Exists',
		name: 'ifLeadExists',
		type: 'options',
		default: 'error',
		options: [
			{
				name: 'Stop With Error',
				value: 'error',
				description: 'Fail the node with the existing lead and the next step',
			},
			{
				name: 'Return Existing Lead',
				value: 'returnExisting',
				description: 'Continue the workflow with the existing lead, marked with already_existed',
			},
		],
		description: 'What to do when the phone or email already belongs to another lead',
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
			await getCollectionWithUserIds(this, 'additionalFields', itemIndex, context),
			LEAD_BODY_FIELDS,
			'create',
			context.timeZone,
		),
	};
	const customFields = readCustomFields(this, 'lead', 'create', itemIndex, context.timeZone);
	if (customFields) body.custom_fields = customFields;
	const ifLeadExists = this.getNodeParameter('ifLeadExists', itemIndex, 'error') as string;
	// The request already carries its Idempotency-Key (see createRecord), so a
	// "Retry On Fail" retry replays instead of duplicating, with either option.
	try {
		const created = await createRecord.call(this, itemIndex, context, '/v1/leads', body);
		// Only this mode marks the output, so workflows on the default keep their fields.
		return ifLeadExists === 'returnExisting' ? { ...created, already_existed: false } : created;
	} catch (error) {
		// Node errors pass through untouched, so the message, description and
		// HTTP context (including the contact_exists body) stay intact.
		const nodeError =
			error instanceof NodeApiError || error instanceof NodeOperationError
				? error
				: new NodeOperationError(this.getNode(), error as Error, { itemIndex });
		if (ifLeadExists === 'returnExisting') {
			const conflict = contactExistsFromError(error);
			if (conflict) {
				return { ...conflict.lead, already_existed: true, matched_by: conflict.matchedBy };
			}
		}
		throw nodeError;
	}
}
