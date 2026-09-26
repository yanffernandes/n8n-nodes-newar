import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { BodyField, QueryField } from '../../helpers/fields';

/** Task fields of Create (Additional Fields) and Update (Update Fields). */

export const TASK_BODY_FIELDS: BodyField[] = [
	{ param: 'assignedToId', api: 'assigned_to_id', kind: 'id', label: 'Assignee' },
	{ param: 'dealId', api: 'deal_id', kind: 'nullableId', label: 'Deal' },
	{ param: 'description', api: 'description', kind: 'nullableText', label: 'Description' },
	{ param: 'dueAt', api: 'due_at', kind: 'dateTime', label: 'Due Date' },
	{ param: 'kind', api: 'kind', kind: 'enum', label: 'Type' },
	{ param: 'priority', api: 'priority', kind: 'enum', label: 'Priority' },
	{ param: 'status', api: 'status', kind: 'enum', label: 'Status' },
	{ param: 'title', api: 'title', kind: 'text', label: 'Title' },
];

export const TASK_FILTERS: QueryField[] = [
	{ param: 'assignedToId', api: 'assigned_to_id', kind: 'id', label: 'Assignee' },
	{ param: 'dealId', api: 'deal_id', kind: 'id', label: 'Deal ID' },
	{ param: 'dueSince', api: 'due_since', kind: 'dateTime', label: 'Due Since' },
	{ param: 'dueUntil', api: 'due_until', kind: 'dateTime', label: 'Due Before' },
	{ param: 'ids', api: 'ids', kind: 'idCsv', label: 'IDs' },
	{ param: 'kind', api: 'kind', kind: 'csv', label: 'Type' },
	{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' },
	{ param: 'status', api: 'status', kind: 'csv', label: 'Status' },
	{ param: 'updatedSince', api: 'updated_since', kind: 'dateTime', label: 'Updated Since' },
	{ param: 'updatedUntil', api: 'updated_until', kind: 'dateTime', label: 'Updated Before' },
];

export const TASK_KIND_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Call', value: 'call' },
	{ name: 'Email', value: 'email' },
	{ name: 'Meeting', value: 'meeting' },
	{ name: 'Other', value: 'other' },
	{ name: 'Visit', value: 'visit' },
	{ name: 'WhatsApp Call', value: 'call_whatsapp' },
	{ name: 'WhatsApp Message', value: 'message_whatsapp' },
];

export const TASK_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Canceled', value: 'canceled' },
	{ name: 'Done', value: 'done' },
	{ name: 'Open', value: 'open' },
];

export const TASK_PRIORITY_OPTIONS: INodePropertyOptions[] = [
	{ name: 'High', value: 'high' },
	{ name: 'Low', value: 'low' },
	{ name: 'Normal', value: 'normal' },
];

export const taskCreateFields: INodeProperties[] = [
	{
		displayName: 'Assignee Email, Name or ID',
		name: 'assignedToId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		description:
			'User who does the task. Defaults to the user of the token. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Deal Name or ID',
		name: 'dealId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLeadDeals', loadOptionsDependsOn: ['leadId.value'] },
		default: '',
		description:
			'One of the deals of the lead. Without it, the task belongs to the lead only. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Details of the task',
	},
	{
		displayName: 'Due Date',
		name: 'dueAt',
		type: 'dateTime',
		default: '',
		description:
			'When the task is due, read in the workflow time zone. Without it, the task has no due date.',
	},
	{
		displayName: 'Priority',
		name: 'priority',
		type: 'options',
		options: TASK_PRIORITY_OPTIONS,
		default: 'normal',
		description: 'Priority of the task',
	},
	{
		displayName: 'Type',
		name: 'kind',
		type: 'options',
		options: TASK_KIND_OPTIONS,
		default: 'other',
		description:
			'Kind of task. Calls and messages complete on their own when they happen in Newar. It cannot change later.',
	},
];

export const taskUpdateFields: INodeProperties[] = [
	{
		displayName: 'Assignee Email, Name or ID',
		name: 'assignedToId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		description:
			'User who does the task. Expressions can use the ID, the email or the full name of a Newar user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Details of the task. Leave empty to clear them.',
	},
	{
		displayName: 'Due Date',
		name: 'dueAt',
		type: 'dateTime',
		default: '',
		description:
			'When the task is due, read in the workflow time zone. Leave empty to remove the due date.',
	},
	{
		displayName: 'Priority',
		name: 'priority',
		type: 'options',
		options: TASK_PRIORITY_OPTIONS,
		default: 'normal',
		description: 'Priority of the task',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: TASK_STATUS_OPTIONS,
		default: 'done',
		description: 'Done completes the task, Canceled cancels it, Open reopens it',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		placeholder: 'e.g. Call to confirm the visit',
		description: 'Title of the task',
	},
];
