import type {
	IDataObject,
	IDisplayOptions,
	IExecuteFunctions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { isUuid } from '../helpers/fields';
import { customIdempotencyKey, deriveIdempotencyKey } from '../helpers/idempotency';
import type { IdempotencySource } from '../helpers/idempotency';
import { applyOutput, RECORD_FIELDS, type OutputEntity, type OutputMode } from '../helpers/output';
import { resolveUserParameters, type NewarUser, type UserResolver } from '../helpers/owner';
import { newarApiRequest } from '../transport';

/** Per-execution values shared by every item. */
export interface ExecutionContext {
	timeZone: string;
	idempotency: Omit<IdempotencySource, 'itemIndex'>;
	/** Turns owner and assignee emails or names into user IDs, reading the users at most once. */
	resolveUser: UserResolver;
}

export type OperationResult = IDataObject | IDataObject[];

export type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
) => Promise<OperationResult>;

export const UUID_REGEX =
	'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/** Adds `displayOptions` to every property (a copy of n8n's internal helper). */
export function updateDisplayOptions(
	displayOptions: IDisplayOptions,
	properties: INodeProperties[],
): INodeProperties[] {
	return properties.map((property) => ({
		...property,
		displayOptions: {
			...property.displayOptions,
			show: { ...displayOptions.show, ...property.displayOptions?.show },
			...(displayOptions.hide || property.displayOptions?.hide
				? { hide: { ...displayOptions.hide, ...property.displayOptions?.hide } }
				: {}),
		},
	}));
}

interface LocatorOptions {
	displayName: string;
	name: string;
	searchListMethod: string;
	description: string;
	/** Noun used in the placeholder, e.g. "lead". */
	noun: string;
	required?: boolean;
}

/** A record picker: "From List" (searchable) or "By ID" (validated UUID). */
export function recordLocator(options: LocatorOptions): INodeProperties {
	return {
		displayName: options.displayName,
		name: options.name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: options.required ?? true,
		description: options.description,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: `Select a ${options.noun}...`,
				typeOptions: {
					searchListMethod: options.searchListMethod,
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: UUID_REGEX,
							errorMessage: 'Not a valid Newar ID. Newar IDs are UUIDs.',
						},
					},
				],
			},
		],
	};
}

export function returnAllProperty(): INodeProperties {
	return {
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	};
}

export function limitProperty(maxValue: number): INodeProperties {
	return {
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue },
		displayOptions: { show: { returnAll: [false] } },
		description: 'Max number of results to return',
	};
}

export function idempotencyOptions(noun: string): INodeProperties {
	return {
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				placeholder: 'e.g. order-2026-000123',
				description: `A stable value that identifies this ${noun} in the source system, such as its ID. Newar then creates it once, even if the workflow runs again within 24 hours. Leave empty to only protect against 'Retry On Fail' duplicates.`,
			},
		],
	};
}

const FIELD_LABELS: Record<string, string> = {
	assigned_to_id: 'Assignee ID',
	close_reason: 'Close Reason',
	closed_at: 'Closed At',
	company: 'Company',
	completed_at: 'Completed At',
	created_at: 'Created At',
	created_by_id: 'Created By ID',
	custom_fields: 'Custom Fields',
	deal_id: 'Deal ID',
	description: 'Description',
	due_at: 'Due At',
	email: 'Email',
	emails: 'Emails',
	id: 'ID',
	is_primary: 'Is Primary',
	kind: 'Type',
	lead_id: 'Lead ID',
	loss_reason_id: 'Loss Reason ID',
	name: 'Name',
	next_step: 'Next Step',
	next_step_due: 'Next Step Due',
	observations: 'Observations',
	opened_at: 'Opened At',
	owner_id: 'Owner ID',
	phone: 'Phone',
	phones: 'Phones',
	pipeline_id: 'Pipeline ID',
	priority: 'Priority',
	score: 'Score',
	source: 'Source',
	stage_entered_at: 'Stage Entered At',
	stage_id: 'Stage ID',
	status: 'Status',
	tag_ids: 'Tag IDs',
	title: 'Title',
	updated_at: 'Updated At',
	utm: 'UTM',
	value: 'Value',
	value_estimate: 'Value Estimate',
};

function fieldOptions(entity: OutputEntity): INodePropertyOptions[] {
	return RECORD_FIELDS[entity]
		.filter((field) => field !== 'id')
		.map((field) => ({ name: FIELD_LABELS[field] ?? field, value: field }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** The "Output" option (Simplified, Raw, Selected Fields) for large records. */
export function outputProperties(entity: OutputEntity): INodeProperties[] {
	return [
		{
			displayName: 'Output',
			name: 'output',
			type: 'options',
			default: 'simplified',
			options: [
				{
					name: 'Simplified',
					value: 'simplified',
					description: 'Return the 10 most useful fields',
				},
				{
					name: 'Raw',
					value: 'raw',
					description: 'Return every field Newar sends, including custom fields',
				},
				{
					name: 'Selected Fields',
					value: 'fields',
					description: 'Return only the fields you choose',
				},
			],
		},
		{
			displayName: 'Fields',
			name: 'fields',
			type: 'multiOptions',
			default: [],
			options: fieldOptions(entity),
			displayOptions: { show: { output: ['fields'] } },
			description: 'The fields to return. The ID is always included.',
		},
	];
}

/** Shapes records according to the node's Output option. */
export function shapeRecords(
	ctx: IExecuteFunctions,
	itemIndex: number,
	entity: OutputEntity,
	records: IDataObject[],
): IDataObject[] {
	const mode = ctx.getNodeParameter('output', itemIndex, 'simplified') as OutputMode;
	const fields =
		mode === 'fields' ? (ctx.getNodeParameter('fields', itemIndex, []) as string[]) : [];
	return records.map((record) => applyOutput(record, entity, mode, fields));
}

/** Reads a record locator and checks the value is a Newar ID. */
export function getRecordId(
	ctx: IExecuteFunctions,
	parameterName: string,
	itemIndex: number,
	label: string,
): string {
	const raw = ctx.getNodeParameter(parameterName, itemIndex, '', { extractValue: true }) as unknown;
	const value = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
	if (value === '') {
		throw new NodeOperationError(ctx.getNode(), `'${label}' is empty`, {
			itemIndex,
			description: `Pick a ${label.toLowerCase()} from the list or enter its ID.`,
		});
	}
	if (!isUuid(value)) {
		throw new NodeOperationError(ctx.getNode(), `'${label}' is not a valid Newar ID`, {
			itemIndex,
			description: `Newar IDs are UUIDs such as 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d. Got '${value}'.`,
		});
	}
	return value.toLowerCase();
}

/** Reads a required text parameter, refusing blank values before calling Newar. */
export function getRequiredText(
	ctx: IExecuteFunctions,
	parameterName: string,
	itemIndex: number,
	label: string,
): string {
	const value = ctx.getNodeParameter(parameterName, itemIndex, '') as unknown;
	const text = typeof value === 'string' ? value : String(value ?? '');
	if (text.trim() === '') {
		throw new NodeOperationError(ctx.getNode(), `'${label}' is empty`, {
			itemIndex,
			description: `Fill in '${label}' or map it from the input data.`,
		});
	}
	return text;
}

export function getCollection(
	ctx: IExecuteFunctions,
	parameterName: string,
	itemIndex: number,
): IDataObject {
	return (ctx.getNodeParameter(parameterName, itemIndex, {}) as IDataObject) ?? {};
}

/** Reads a collection, with an owner or assignee given by email or name turned into a user ID. */
export async function getCollectionWithUserIds(
	ctx: IExecuteFunctions,
	parameterName: string,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject> {
	const values = getCollection(ctx, parameterName, itemIndex);
	return await resolveUserParameters(values, context.resolveUser, itemIndex);
}

/** Reads the workspace users, which Newar returns whole in one response. */
export async function listUsers(this: IExecuteFunctions, itemIndex: number): Promise<NewarUser[]> {
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/users',
		itemIndex,
	});
	return (response.data as NewarUser[] | undefined) ?? [];
}

/** POSTs a create request with an `Idempotency-Key` and returns the created record. */
export async function createRecord(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
	path: string,
	body: IDataObject,
): Promise<IDataObject> {
	const options = getCollection(this, 'options', itemIndex);
	const customKey = typeof options.idempotencyKey === 'string' ? options.idempotencyKey : '';
	const key =
		customKey.trim() !== ''
			? customIdempotencyKey(path, customKey)
			: deriveIdempotencyKey(
					{ ...context.idempotency, itemIndex },
					{ method: 'POST', path },
				);
	const response = await newarApiRequest.call(this, {
		method: 'POST',
		path,
		body,
		headers: key ? { 'Idempotency-Key': key } : undefined,
		itemIndex,
	});
	return (response.data ?? {}) as IDataObject;
}

/** Fetches a single record by path. */
export async function getRecord(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
): Promise<IDataObject> {
	const response = await newarApiRequest.call(this, { method: 'GET', path, itemIndex });
	return (response.data ?? {}) as IDataObject;
}

/** Deletes a record (Newar soft-deletes) and returns `{ id, deleted: true }`. */
export async function deleteRecord(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
): Promise<IDataObject> {
	const response = await newarApiRequest.call(this, { method: 'DELETE', path, itemIndex });
	return (response.data ?? { deleted: true }) as IDataObject;
}

/** PATCHes a record, refusing an update with nothing to change. */
export async function updateRecord(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	body: IDataObject,
): Promise<IDataObject> {
	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Nothing to update', {
			itemIndex,
			description: "Add at least one field under 'Update Fields' or 'Custom Fields'.",
		});
	}
	const response = await newarApiRequest.call(this, { method: 'PATCH', path, body, itemIndex });
	return (response.data ?? {}) as IDataObject;
}

/**
 * Applies Return All / Limit to a list Newar returns whole. Tags, pipelines,
 * stages, users, custom fields and loss reasons come in one response with
 * `next_cursor: null` (the API documents them as whole lists), so one request
 * is complete and Limit only trims the output.
 */
export function applyLimit(
	ctx: IExecuteFunctions,
	itemIndex: number,
	records: IDataObject[],
): IDataObject[] {
	const returnAll = ctx.getNodeParameter('returnAll', itemIndex, false) as boolean;
	if (returnAll) return records;
	const limit = ctx.getNodeParameter('limit', itemIndex, 50) as number;
	return records.slice(0, Math.max(0, limit));
}

/** The "Sort" collection of a Get Many operation. */
export function sortProperty(
	fields: INodePropertyOptions[],
	defaultField: string,
): INodeProperties {
	return {
		displayName: 'Sort',
		name: 'sort',
		type: 'collection',
		placeholder: 'Add Sort Rule',
		default: {},
		options: [
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
				description: 'Order of the results. Newar defaults to descending.',
			},
			{
				displayName: 'Field',
				name: 'field',
				type: 'options',
				options: fields,
				default: defaultField,
				description: 'Field to sort the results by',
			},
		],
	};
}

/** Reads the "Sort" collection into `sort_by` and `sort_direction`. */
export function readSort(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
	const sort = getCollection(ctx, 'sort', itemIndex);
	const query: IDataObject = {};
	if (typeof sort.field === 'string' && sort.field !== '') query.sort_by = sort.field;
	if (typeof sort.direction === 'string' && sort.direction !== '')
		query.sort_direction = sort.direction;
	return query;
}

/** Reads Return All and Limit. */
export function readPaging(
	ctx: IExecuteFunctions,
	itemIndex: number,
): { returnAll: boolean; limit: number } {
	const returnAll = ctx.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? 0 : (ctx.getNodeParameter('limit', itemIndex, 50) as number);
	return { returnAll, limit };
}
