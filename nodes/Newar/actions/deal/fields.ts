import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { BodyField, QueryField } from '../../helpers/fields';

/** Deal fields of Create (Additional Fields) and Update (Update Fields). */

export const DEAL_BODY_FIELDS: BodyField[] = [
	{ param: 'closeReason', api: 'close_reason', kind: 'nullableText', label: 'Close Reason' },
	{ param: 'lossReasonId', api: 'loss_reason_id', kind: 'nullableId', label: 'Loss Reason' },
	{ param: 'nextStep', api: 'next_step', kind: 'nullableText', label: 'Next Step' },
	{ param: 'nextStepDue', api: 'next_step_due', kind: 'date', label: 'Next Step Due Date' },
	{ param: 'observations', api: 'observations', kind: 'nullableText', label: 'Observations' },
	{ param: 'ownerId', api: 'owner_id', kind: 'nullableId', label: 'Owner' },
	{ param: 'pipelineId', api: 'pipeline_id', kind: 'id', label: 'Pipeline' },
	{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
	{ param: 'status', api: 'status', kind: 'enum', label: 'Status' },
	{ param: 'title', api: 'title', kind: 'text', label: 'Title' },
	{ param: 'value', api: 'value', kind: 'nullableNumber', label: 'Value' },
];

export const DEAL_FILTERS: QueryField[] = [
	{ param: 'ids', api: 'ids', kind: 'idCsv', label: 'IDs' },
	{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' },
	{ param: 'ownerId', api: 'owner_id', kind: 'id', label: 'Owner' },
	{ param: 'pipelineId', api: 'pipeline_id', kind: 'id', label: 'Pipeline' },
	{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
	{ param: 'status', api: 'status', kind: 'csv', label: 'Status' },
	{ param: 'updatedSince', api: 'updated_since', kind: 'dateTime', label: 'Updated Since' },
	{ param: 'updatedUntil', api: 'updated_until', kind: 'dateTime', label: 'Updated Before' },
];

export const DEAL_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Lost', value: 'lost' },
	{ name: 'Open', value: 'open' },
	{ name: 'Won', value: 'won' },
];

export const dealCreateFields: INodeProperties[] = [
	{
		displayName: 'Next Step',
		name: 'nextStep',
		type: 'string',
		default: '',
		placeholder: 'e.g. Schedule the campus visit',
		description: 'What should happen next with the deal',
	},
	{
		displayName: 'Next Step Due Date',
		name: 'nextStepDue',
		type: 'dateTime',
		default: '',
		description: 'When the next step is due. Only the date is used.',
	},
	{
		displayName: 'Observations',
		name: 'observations',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Free-text notes about the deal',
	},
	{
		displayName: 'Owner Email, Name or ID',
		name: 'ownerId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		description:
			'User responsible for the deal. Defaults to the owner of the lead. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Pipeline Name or ID',
		name: 'pipelineId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPipelines' },
		default: '',
		description:
			'Pipeline of the deal. Without a stage, the deal starts in its first open stage. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Stage Name or ID',
		name: 'stageId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getStages',
			loadOptionsDependsOn: ['additionalFields.pipelineId'],
		},
		default: '',
		description:
			'Stage the deal enters. Without it, the deal starts in the first open stage of the pipeline. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2027 enrollment',
		description:
			'Title of the deal. Defaults to the company of the lead, or its name when there is no company.',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'number',
		typeOptions: { minValue: 0, numberPrecision: 2 },
		default: 0,
		description: 'Value of the deal, in BRL',
	},
];

export const dealUpdateFields: INodeProperties[] = [
	{
		displayName: 'Close Reason',
		name: 'closeReason',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		placeholder: 'e.g. Chose the school next door',
		description:
			"Comment saved when the deal is won or lost. Only used together with 'Status' Won or Lost.",
	},
	{
		displayName: 'Loss Reason Name or ID',
		name: 'lossReasonId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLossReasons' },
		default: '',
		description:
			'Why the deal was lost. Only used together with \'Status\' Lost. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Next Step',
		name: 'nextStep',
		type: 'string',
		default: '',
		placeholder: 'e.g. Schedule the campus visit',
		description: 'What should happen next with the deal. Leave empty to clear it.',
	},
	{
		displayName: 'Next Step Due Date',
		name: 'nextStepDue',
		type: 'dateTime',
		default: '',
		description: 'When the next step is due. Only the date is used. Leave empty to clear it.',
	},
	{
		displayName: 'Observations',
		name: 'observations',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Free-text notes about the deal. Leave empty to clear them.',
	},
	{
		displayName: 'Owner Email, Name or ID',
		name: 'ownerId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		description:
			'User responsible for the deal. Leave empty to remove the owner. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Stage Name or ID',
		name: 'stageId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getStages' },
		default: '',
		description:
			'Moves the deal, even to another pipeline. A won or lost deal only moves together with \'Status\' Open. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: DEAL_STATUS_OPTIONS,
		default: 'open',
		description: 'Won or Lost closes the deal, Open reopens it',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2027 enrollment',
		description: 'Title of the deal',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'number',
		typeOptions: { minValue: 0, numberPrecision: 2 },
		default: 0,
		description: 'Value of the deal, in BRL. To clear it, use an expression that returns null.',
	},
];
