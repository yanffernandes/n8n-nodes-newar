import type { INodeProperties } from 'n8n-workflow';

import type { BodyField, QueryField } from '../../helpers/fields';

/** Lead fields of Create (Additional Fields) and Update (Update Fields). */

export const LEAD_BODY_FIELDS: BodyField[] = [
	{ param: 'company', api: 'company', kind: 'nullableText', label: 'Company' },
	{ param: 'email', api: 'email', kind: 'nullableText', label: 'Email' },
	{ param: 'name', api: 'name', kind: 'text', label: 'Name' },
	{ param: 'nextStep', api: 'next_step', kind: 'nullableText', label: 'Next Step' },
	{ param: 'nextStepDue', api: 'next_step_due', kind: 'date', label: 'Next Step Due Date' },
	{ param: 'observations', api: 'observations', kind: 'nullableText', label: 'Observations' },
	{ param: 'ownerId', api: 'owner_id', kind: 'nullableId', label: 'Owner' },
	{ param: 'phone', api: 'phone', kind: 'nullableText', label: 'Phone' },
	{ param: 'pipelineId', api: 'pipeline_id', kind: 'id', label: 'Pipeline' },
	{ param: 'source', api: 'source', kind: 'text', label: 'Source' },
	{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
	{ param: 'tagIds', api: 'tag_ids', kind: 'idList', label: 'Tags' },
	{
		param: 'valueEstimate',
		api: 'value_estimate',
		kind: 'nullableNumber',
		label: 'Value Estimate',
	},
];

export const LEAD_FILTERS: QueryField[] = [
	{ param: 'ids', api: 'ids', kind: 'idCsv', label: 'IDs' },
	{ param: 'ownerId', api: 'owner_id', kind: 'id', label: 'Owner' },
	{ param: 'pipelineId', api: 'pipeline_id', kind: 'id', label: 'Pipeline' },
	{ param: 'source', api: 'source', kind: 'text', label: 'Source' },
	{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
	{ param: 'tagId', api: 'tag_id', kind: 'id', label: 'Tag' },
	{ param: 'updatedSince', api: 'updated_since', kind: 'dateTime', label: 'Updated Since' },
	{ param: 'updatedUntil', api: 'updated_until', kind: 'dateTime', label: 'Updated Before' },
];

export const leadCreateFields: INodeProperties[] = [
	{
		displayName: 'Company',
		name: 'company',
		type: 'string',
		default: '',
		placeholder: 'e.g. Sunrise School',
		description: 'Company or institution of the lead',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		default: '',
		placeholder: 'name@email.com',
		description: 'Primary email address',
	},
	{
		displayName: 'Next Step',
		name: 'nextStep',
		type: 'string',
		default: '',
		placeholder: 'e.g. Send the revised proposal',
		description: 'What should happen next with the lead',
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
		description: 'Free-text notes about the lead',
	},
	{
		displayName: 'Owner Email, Name or ID',
		name: 'ownerId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		description:
			'User responsible for the lead. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5511999990000',
		description: 'Primary phone number, with country and area code',
	},
	{
		displayName: 'Pipeline Name or ID',
		name: 'pipelineId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPipelines' },
		default: '',
		description:
			'Pipeline the lead enters. Without a stage, the lead starts in its first open stage. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Source',
		name: 'source',
		type: 'string',
		default: '',
		placeholder: 'e.g. website',
		description: "Where the lead came from. Newar uses 'api' when empty.",
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
			'Stage the lead enters. Without it, the lead starts in the first open stage of the first pipeline. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Tag Names or IDs',
		name: 'tagIds',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getLeadTags' },
		default: [],
		description:
			'Tags to add to the lead. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Value Estimate',
		name: 'valueEstimate',
		type: 'number',
		typeOptions: { minValue: 0, numberPrecision: 2 },
		default: 0,
		description: 'Estimated value of the lead, in BRL',
	},
];

export const leadUpdateFields: INodeProperties[] = [
	{
		displayName: 'Company',
		name: 'company',
		type: 'string',
		default: '',
		placeholder: 'e.g. Sunrise School',
		description: 'Company or institution of the lead. Leave empty to clear it.',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		default: '',
		placeholder: 'name@email.com',
		description: 'Primary email address. Leave empty to clear it.',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		placeholder: 'e.g. Nathan Smith',
		description: "The lead's full name",
	},
	{
		displayName: 'Next Step',
		name: 'nextStep',
		type: 'string',
		default: '',
		placeholder: 'e.g. Send the revised proposal',
		description: 'What should happen next with the lead. Leave empty to clear it.',
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
		description: 'Free-text notes about the lead. Leave empty to clear them.',
	},
	{
		displayName: 'Owner Email, Name or ID',
		name: 'ownerId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		description:
			'User responsible for the lead. Leave empty to remove the owner. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5511999990000',
		description: 'Primary phone number, with country and area code. Leave empty to clear it.',
	},
	{
		displayName: 'Source',
		name: 'source',
		type: 'string',
		default: '',
		placeholder: 'e.g. website',
		description: 'Where the lead came from',
	},
	{
		displayName: 'Stage Name or ID',
		name: 'stageId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getStages' },
		default: '',
		description:
			'Moves the lead, and its primary deal, to this stage. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Tag Names or IDs',
		name: 'tagIds',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getLeadTags' },
		default: [],
		description:
			'Replaces all of the lead\'s tags. Leave empty to remove every tag. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Value Estimate',
		name: 'valueEstimate',
		type: 'number',
		typeOptions: { minValue: 0, numberPrecision: 2 },
		default: 0,
		description:
			'Estimated value of the lead, in BRL. To clear it, use an expression that returns null.',
	},
];
