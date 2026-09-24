import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import {
	createRecord,
	getRecordId,
	getRequiredText,
	idempotencyOptions,
	recordLocator,
	updateDisplayOptions,
	type ExecutionContext,
} from '../common';

const properties: INodeProperties[] = [
	{
		displayName: 'Add To',
		name: 'parent',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Deal',
				value: 'deal',
				description: "The note appears on the deal and on the deal's lead",
			},
			{
				name: 'Lead',
				value: 'lead',
				description: "The note appears on the lead's timeline",
			},
		],
		default: 'lead',
		description: 'Where to add the note',
	},
	{
		...recordLocator({
			displayName: 'Lead',
			name: 'leadId',
			searchListMethod: 'searchLeads',
			noun: 'lead',
			description: 'The lead to add the note to',
		}),
		displayOptions: { show: { parent: ['lead'] } },
	},
	{
		...recordLocator({
			displayName: 'Deal',
			name: 'dealId',
			searchListMethod: 'searchDeals',
			noun: 'deal',
			description: 'The deal to add the note to',
		}),
		displayOptions: { show: { parent: ['deal'] } },
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. Asked us to call after 6 pm',
		description: "Text of the note. The token's user is the author.",
	},
	idempotencyOptions('note'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['note'], operation: ['create'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const parent = this.getNodeParameter('parent', itemIndex, 'lead') as string;
	const body: IDataObject =
		parent === 'deal'
			? { deal_id: getRecordId(this, 'dealId', itemIndex, 'Deal') }
			: { lead_id: getRecordId(this, 'leadId', itemIndex, 'Lead') };
	body.content = getRequiredText(this, 'content', itemIndex, 'Content');
	return await createRecord.call(this, itemIndex, context, '/v1/notes', body);
}
