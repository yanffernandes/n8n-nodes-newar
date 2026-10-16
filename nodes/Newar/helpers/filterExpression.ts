import type { IDataObject } from 'n8n-workflow';

import { toIsoDateTime } from './dates';

export type LeadFilterFieldType = 'text' | 'number' | 'boolean' | 'enum' | 'local_date' | 'instant';
export type LeadFilterOperator =
	| 'eq'
	| 'neq'
	| 'in'
	| 'not_in'
	| 'contains'
	| 'not_contains'
	| 'starts_with'
	| 'ends_with'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'between'
	| 'is_null'
	| 'is_not_null'
	| 'is_empty'
	| 'is_not_empty'
	| 'contains_any'
	| 'contains_all'
	| 'contains_none'
	| 'before'
	| 'on_or_before'
	| 'after'
	| 'on_or_after'
	| 'older_than'
	| 'newer_than'
	| 'within_last'
	| 'within_next'
	| 'calendar_period'
	| 'is_missing'
	| 'is_present';

export interface LeadFilterField {
	id: string;
	label: string;
	type: LeadFilterFieldType;
	source: 'native' | 'custom';
	operators: LeadFilterOperator[];
	options?: string[];
	description?: string;
}

const NATIVE_TEXT_OPERATORS: LeadFilterOperator[] = [
	'eq',
	'neq',
	'in',
	'not_in',
	'contains',
	'not_contains',
	'starts_with',
	'ends_with',
	'is_null',
	'is_not_null',
	'is_empty',
	'is_not_empty',
];
const NATIVE_NUMBER_OPERATORS: LeadFilterOperator[] = [
	'eq',
	'neq',
	'in',
	'not_in',
	'gt',
	'gte',
	'lt',
	'lte',
	'between',
	'is_null',
	'is_not_null',
];
const NATIVE_BOOLEAN_OPERATORS: LeadFilterOperator[] = ['eq', 'neq', 'is_null', 'is_not_null'];
const NATIVE_INSTANT_OPERATORS: LeadFilterOperator[] = [
	'eq',
	'neq',
	'before',
	'on_or_before',
	'after',
	'on_or_after',
	'between',
	'older_than',
	'newer_than',
	'within_last',
	'within_next',
	'calendar_period',
	'is_null',
	'is_not_null',
];

/** Native fields exposed by the latest public.crm_filter_leads_v1 view. */
export const NATIVE_LEAD_FILTER_FIELDS: LeadFilterField[] = [
	{ id: 'name', label: 'Name', type: 'text', source: 'native', operators: NATIVE_TEXT_OPERATORS },
	{
		id: 'source',
		label: 'Source',
		type: 'text',
		source: 'native',
		operators: NATIVE_TEXT_OPERATORS,
	},
	{
		id: 'score',
		label: 'Score',
		type: 'number',
		source: 'native',
		operators: NATIVE_NUMBER_OPERATORS,
	},
	{
		id: 'created_at',
		label: 'Created At',
		type: 'instant',
		source: 'native',
		operators: NATIVE_INSTANT_OPERATORS,
	},
	{
		id: 'opened_at',
		label: 'Opened At',
		type: 'instant',
		source: 'native',
		operators: NATIVE_INSTANT_OPERATORS,
	},
	{
		id: 'owner_name',
		label: 'Owner Name',
		type: 'text',
		source: 'native',
		operators: NATIVE_TEXT_OPERATORS,
	},
	{
		id: 'channel',
		label: 'Channel',
		type: 'text',
		source: 'native',
		operators: NATIVE_TEXT_OPERATORS,
	},
	{
		id: 'converted',
		label: 'Converted',
		type: 'boolean',
		source: 'native',
		operators: NATIVE_BOOLEAN_OPERATORS,
		description: 'Requires the Pipeline permission.',
	},
	{
		id: 'mql',
		label: 'MQL',
		type: 'boolean',
		source: 'native',
		operators: NATIVE_BOOLEAN_OPERATORS,
	},
];

const CUSTOM_OPERATORS: Record<LeadFilterFieldType, LeadFilterOperator[]> = {
	text: [
		'eq',
		'neq',
		'in',
		'not_in',
		'contains',
		'not_contains',
		'starts_with',
		'ends_with',
		'is_null',
		'is_not_null',
		'is_empty',
		'is_not_empty',
		'is_missing',
		'is_present',
	],
	number: [
		'eq',
		'neq',
		'in',
		'not_in',
		'gt',
		'gte',
		'lt',
		'lte',
		'between',
		'is_null',
		'is_not_null',
		'is_missing',
		'is_present',
	],
	boolean: ['eq', 'neq', 'is_null', 'is_not_null', 'is_missing', 'is_present'],
	enum: ['eq', 'neq', 'in', 'not_in', 'is_null', 'is_not_null', 'is_missing', 'is_present'],
	local_date: [
		'eq',
		'neq',
		'before',
		'on_or_before',
		'after',
		'on_or_after',
		'between',
		'is_null',
		'is_not_null',
		'is_missing',
		'is_present',
	],
	instant: NATIVE_INSTANT_OPERATORS,
};

export const FILTER_OPERATOR_LABELS: Record<LeadFilterOperator, string> = {
	eq: 'Is',
	neq: 'Is Not',
	in: 'Is One Of',
	not_in: 'Is Not One Of',
	contains: 'Contains',
	not_contains: 'Does Not Contain',
	starts_with: 'Starts With',
	ends_with: 'Ends With',
	gt: 'Greater Than',
	gte: 'Greater Than or Equal To',
	lt: 'Less Than',
	lte: 'Less Than or Equal To',
	between: 'Is Between',
	is_null: 'Is Null',
	is_not_null: 'Is Not Null',
	is_empty: 'Is Empty',
	is_not_empty: 'Is Not Empty',
	contains_any: 'Contains Any',
	contains_all: 'Contains All',
	contains_none: 'Contains None',
	before: 'Before',
	on_or_before: 'On or Before',
	after: 'After',
	on_or_after: 'On or After',
	older_than: 'Older Than',
	newer_than: 'Newer Than',
	within_last: 'Within Last',
	within_next: 'Within Next',
	calendar_period: 'In Calendar Period',
	is_missing: 'Is Missing',
	is_present: 'Is Present',
};

export const VALUELESS_FILTER_OPERATORS: LeadFilterOperator[] = [
	'is_null',
	'is_not_null',
	'is_empty',
	'is_not_empty',
	'is_missing',
	'is_present',
];

const POSITIVE_CUSTOM_FIELD_OPERATORS = new Set<LeadFilterOperator>([
	'eq',
	'in',
	'contains',
	'starts_with',
	'ends_with',
	'gt',
	'gte',
	'lt',
	'lte',
	'between',
	'before',
	'on_or_before',
	'after',
	'on_or_after',
	'older_than',
	'newer_than',
	'within_last',
	'within_next',
	'calendar_period',
	'contains_any',
	'contains_all',
]);

const NEGATIVE_CUSTOM_FIELD_OPERATORS = new Set<LeadFilterOperator>([
	'neq',
	'not_in',
	'not_contains',
	'contains_none',
]);

const MAX_FILTER_EXPRESSION_DEPTH = 6;
const MAX_FILTER_EXPRESSION_NODES = 100;
const MAX_FILTER_EXPRESSION_AST_UNITS = 65_536;
const MAX_FILTER_EXPRESSION_WIRE_BYTES = 65_536;

const TYPE_LABELS: Record<LeadFilterFieldType, string> = {
	text: 'text',
	number: 'number',
	boolean: 'boolean',
	enum: 'select',
	local_date: 'date',
	instant: 'date and time',
};

export function customLeadFilterFields(fields: IDataObject[]): LeadFilterField[] {
	return fields.flatMap((field) => {
		const key = typeof field.key === 'string' ? field.key : '';
		const type = customFieldType(field.type);
		if (!key || !type) return [];
		const options = Array.isArray(field.options)
			? field.options.filter((option): option is string => typeof option === 'string')
			: [];
		return [
			{
				id: `cf:${key}`,
				label: `${String(field.label ?? key)} (Custom Field)`,
				type,
				source: 'custom' as const,
				operators: CUSTOM_OPERATORS[type],
				...(type === 'enum' ? { options } : {}),
			},
		];
	});
}

function customFieldType(value: unknown): LeadFilterFieldType | undefined {
	if (value === 'number') return 'number';
	if (value === 'boolean') return 'boolean';
	if (value === 'date') return 'local_date';
	if (
		value === 'instant' ||
		value === 'datetime' ||
		value === 'date_time' ||
		value === 'date-time'
	) {
		return 'instant';
	}
	if (value === 'select') return 'enum';
	if (value === 'text') return 'text';
	return undefined;
}

export function leadFilterCatalog(customFields: IDataObject[]): LeadFilterField[] {
	return [...NATIVE_LEAD_FILTER_FIELDS, ...customLeadFilterFields(customFields)];
}

export function operatorOptions(
	field: LeadFilterField | undefined,
): Array<{ name: string; value: string }> {
	if (!field) return [];
	return field.operators.map((operator) => ({
		name: FILTER_OPERATOR_LABELS[operator],
		value: operator,
	}));
}

export class LeadFilterExpressionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LeadFilterExpressionError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expressionSize(node: unknown, depth = 1): { nodes: number; maxDepth: number } {
	if (!isRecord(node)) return { nodes: 0, maxDepth: depth };
	if (node.kind === 'scalar') return { nodes: 1, maxDepth: depth };
	if ((node.kind !== 'all' && node.kind !== 'any') || !Array.isArray(node.items)) {
		return { nodes: 1, maxDepth: depth };
	}
	const children = node.items.map((child) => expressionSize(child, depth + 1));
	return {
		nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
		maxDepth: Math.max(depth, ...children.map((child) => child.maxDepth)),
	};
}

function compileCondition(
	field: LeadFilterField,
	operator: LeadFilterOperator,
	value: unknown,
): IDataObject[] {
	const condition: IDataObject = {
		kind: 'scalar',
		field: field.id,
		operator,
		...(value === undefined ? {} : { value }),
	};
	if (field.source !== 'custom') return [condition];

	const presence: IDataObject = { kind: 'scalar', field: field.id, operator: 'is_present' };
	if (POSITIVE_CUSTOM_FIELD_OPERATORS.has(operator)) return [presence, condition];
	if (NEGATIVE_CUSTOM_FIELD_OPERATORS.has(operator)) {
		return [
			{
				kind: 'any',
				items: [{ kind: 'scalar', field: field.id, operator: 'is_missing' }, condition],
			},
		];
	}
	return [condition];
}

function collectionItems(value: unknown, collectionName: string): Record<string, unknown>[] {
	if (Array.isArray(value)) return value.filter(isRecord);
	if (!isRecord(value)) return [];
	const nested = value[collectionName];
	return Array.isArray(nested) ? nested.filter(isRecord) : [];
}

function validatedCollectionItems(
	value: unknown,
	collectionName: string,
	label: string,
	entryName: string,
): Record<string, unknown>[] {
	if (value === undefined || value === null) return [];
	const items = Array.isArray(value)
		? value
		: isRecord(value) && Object.keys(value).length === 0
			? []
			: isRecord(value) && Array.isArray(value[collectionName])
				? value[collectionName]
				: undefined;
	if (!items) {
		throw new LeadFilterExpressionError(`${label} must contain a list of entries.`);
	}
	const malformedIndex = items.findIndex((item) => !isRecord(item));
	if (malformedIndex !== -1) {
		throw new LeadFilterExpressionError(
			`${label} ${entryName} ${malformedIndex + 1} is malformed. Remove it or add a valid entry before searching.`,
		);
	}
	return items as Record<string, unknown>[];
}

function readGroups(value: unknown): Record<string, unknown>[] {
	return collectionItems(value, 'group');
}

function readConditions(group: Record<string, unknown>): Record<string, unknown>[] {
	return collectionItems(group.conditions, 'condition');
}

export function hasCustomLeadFilterField(input: unknown): boolean {
	return readGroups(input).some((group) =>
		readConditions(group).some((condition) => readText(condition.field).startsWith('cf:')),
	);
}

function readText(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return '';
}

function filterTextByteLength(value: string): number | null {
	let byteLength = 0;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code === 0) return null;
		if (code <= 0x7f) byteLength += 1;
		else if (code <= 0x7ff) byteLength += 2;
		else if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!Number.isFinite(next) || next < 0xdc00 || next > 0xdfff) return null;
			byteLength += 4;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) return null;
		else byteLength += 3;
	}
	return byteLength;
}

function expressionAstUnits(value: unknown): number | null {
	const stack = [value];
	let units = 0;
	while (stack.length > 0) {
		const current = stack.pop();
		if (typeof current === 'string') {
			const bytes = filterTextByteLength(current);
			if (bytes === null) return null;
			units += 1 + bytes;
		} else if (typeof current === 'number') {
			if (!Number.isFinite(current)) return null;
			units += 1;
		} else if (typeof current === 'boolean' || current === null) {
			units += 1;
		} else if (Array.isArray(current)) {
			units += 1 + current.length;
			for (let index = current.length - 1; index >= 0; index -= 1) {
				stack.push(current[index]);
			}
		} else if (isRecord(current)) {
			units += 1;
			for (const [key, entry] of Object.entries(current)) {
				const keyBytes = filterTextByteLength(key);
				if (keyBytes === null) return null;
				units += 1 + keyBytes;
				stack.push(entry);
			}
		} else return null;
		if (units > MAX_FILTER_EXPRESSION_AST_UNITS) return units;
	}
	return units;
}

function filterIdentifierIsValid(value: string): boolean {
	return value.length > 0 && [...value].length <= 256 && filterTextByteLength(value) !== null;
}

function valueExample(field: LeadFilterField): string {
	if (field.type === 'local_date') return 'Example: 2026-10-16.';
	if (field.type === 'instant') {
		return 'Example: 2026-10-16T09:30:00-03:00 or 2026-10-16.';
	}
	return '';
}

function requiredValue(
	condition: Record<string, unknown>,
	field: LeadFilterField,
	label: string,
): string {
	const raw = condition.value;
	const value =
		typeof raw === 'string'
			? raw.trim()
			: typeof raw === 'boolean'
				? String(raw)
				: typeof raw === 'number' && Number.isFinite(raw)
					? String(raw)
					: '';
	if (value === '') {
		const example = valueExample(field);
		throw new LeadFilterExpressionError(
			`'${label}' for '${field.label}' must have a non-empty value.${example ? ` ${example}` : ''}`,
		);
	}
	if (filterTextByteLength(value) === null) {
		throw new LeadFilterExpressionError(
			`'${label}' contains invalid Unicode or a null character. Remove it before searching.`,
		);
	}
	return value;
}

function splitValues(value: string, label: string, field: LeadFilterField): string[] {
	const values = value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (values.length === 0) {
		const example = valueExample(field);
		throw new LeadFilterExpressionError(
			`'${label}' for '${field.label}' must contain at least one value.${example ? ` ${example}` : ''}`,
		);
	}
	return values;
}

function parseNumber(value: string, label: string): number {
	if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
		throw new LeadFilterExpressionError(`'${label}' must be a decimal number, such as 12 or -3.5.`);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new LeadFilterExpressionError(
			`'${label}' must be a finite decimal number, such as 12 or -3.5.`,
		);
	}
	return number;
}

function parseDate(value: string, label: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
		throw new LeadFilterExpressionError(`'${label}' must use YYYY-MM-DD. Example: 2026-10-16.`);
	}
	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
		throw new LeadFilterExpressionError(
			`'${label}' must be a valid calendar date. Example: 2026-10-16.`,
		);
	}
	return value;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const RFC3339_INSTANT =
	/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/;

function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
		return true;
	} catch {
		return false;
	}
}

function invalidInstantMessage(label: string): string {
	return `'${label}' must use valid RFC3339 with a timezone offset or YYYY-MM-DD. Example: 2026-10-16T09:30:00-03:00 or 2026-10-16.`;
}

function parseInstant(value: string, label: string, timeZone: string): string {
	if (DATE_ONLY.test(value)) {
		parseDate(value, label);
		if (!isValidTimeZone(timeZone)) {
			throw new LeadFilterExpressionError(
				`'${label}' needs a valid workflow time zone to interpret YYYY-MM-DD. Example: America/Sao_Paulo.`,
			);
		}
	} else {
		const match = RFC3339_INSTANT.exec(value);
		if (!match) {
			throw new LeadFilterExpressionError(invalidInstantMessage(label));
		}
		const hour = Number(match[2]);
		const minute = Number(match[3]);
		const second = Number(match[4]);
		const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
		const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
		if (
			match[1].startsWith('0000-') ||
			hour > 23 ||
			minute > 59 ||
			second > 59 ||
			offsetHour > 15 ||
			offsetMinute > 59
		) {
			throw new LeadFilterExpressionError(invalidInstantMessage(label));
		}
		parseDate(match[1], label);
	}
	const isoDateTime = toIsoDateTime(value, timeZone);
	if (!isoDateTime) {
		throw new LeadFilterExpressionError(invalidInstantMessage(label));
	}
	return isoDateTime;
}

function parseScalar(
	value: string,
	field: LeadFilterField,
	label: string,
): string | number | boolean {
	switch (field.type) {
		case 'number':
			return parseNumber(value, label);
		case 'boolean':
			if (value.toLowerCase() === 'true') return true;
			if (value.toLowerCase() === 'false') return false;
			throw new LeadFilterExpressionError(`'${label}' must be true or false.`);
		case 'local_date':
			return parseDate(value, label);
		case 'instant':
			return value;
		case 'text':
		case 'enum':
			return value;
	}
}

function parseOperand(
	condition: Record<string, unknown>,
	field: LeadFilterField,
	operator: LeadFilterOperator,
	groupIndex: number,
	conditionIndex: number,
	timeZone: string,
):
	| string
	| number
	| boolean
	| Array<string | number | boolean>
	| Record<string, unknown>
	| undefined {
	if (VALUELESS_FILTER_OPERATORS.includes(operator)) return undefined;

	const label = `Filter Groups group ${groupIndex + 1}, condition ${conditionIndex + 1} (${field.label}) Value`;
	const value = requiredValue(condition, field, label);
	if (operator === 'in' || operator === 'not_in') {
		const values = splitValues(value, label, field).map((entry) =>
			parseScalar(entry, field, label),
		);
		if (field.type === 'enum' && field.options) {
			const invalid = values.find(
				(entry) => typeof entry !== 'string' || !field.options?.includes(entry),
			);
			if (invalid !== undefined) {
				throw new LeadFilterExpressionError(`'${label}' must match an option of '${field.label}'.`);
			}
		}
		return values;
	}
	if (operator === 'between') {
		const bounds = splitValues(value, label, field);
		if (bounds.length !== 2) {
			const example = field.type === 'instant' ? '2026-10-16, 2026-10-17T09:30:00-03:00' : '10, 20';
			throw new LeadFilterExpressionError(
				`'${label}' needs exactly two comma-separated values. Example: ${example}.`,
			);
		}
		if (field.type === 'number') {
			const from = parseNumber(bounds[0], label);
			const to = parseNumber(bounds[1], label);
			if (from > to) {
				throw new LeadFilterExpressionError(
					`'${label}' needs a start value less than or equal to its end value.`,
				);
			}
			return { from, to };
		}
		if (field.type === 'local_date') {
			const from = parseDate(bounds[0], label);
			const to = parseDate(bounds[1], label);
			if (from > to) {
				throw new LeadFilterExpressionError(
					`'${label}' needs a start date on or before its end date. Example: 2026-10-16, 2026-10-17.`,
				);
			}
			return { from, to };
		}
		if (field.type === 'instant') {
			const from = parseInstant(bounds[0], label, timeZone);
			const to = parseInstant(bounds[1], label, timeZone);
			if (Date.parse(from) >= Date.parse(to)) {
				throw new LeadFilterExpressionError(
					`'${label}' needs a start date and time before its end date and time. Example: 2026-10-16T09:30:00-03:00, 2026-10-16T10:30:00-03:00.`,
				);
			}
			return { from, to };
		}
		return { from: bounds[0], to: bounds[1] };
	}
	if (['older_than', 'newer_than', 'within_last', 'within_next'].includes(operator)) {
		const match = value.match(/^([0-9]+(?:\.[0-9]+)?)\s*(seconds?|minutes?|hours?|days?)$/i);
		if (!match) {
			throw new LeadFilterExpressionError(
				`'${label}' must be an amount and unit, such as '3 days'.`,
			);
		}
		const amount = Number(match[1]);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new LeadFilterExpressionError(
				`'${label}' must use a positive amount, such as '3 days'.`,
			);
		}
		const unit = match[2].toLowerCase().replace(/s$/, '') + 's';
		return { amount, unit };
	}
	if (operator === 'calendar_period') {
		const period = value.toLowerCase();
		if (
			!['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'].includes(period)
		) {
			throw new LeadFilterExpressionError(
				`'${label}' must be a supported calendar period, such as 'this_month'.`,
			);
		}
		if (timeZone.length > 128 || !isValidTimeZone(timeZone)) {
			throw new LeadFilterExpressionError(
				`'${label}' needs a valid workflow time zone. Example: America/Sao_Paulo.`,
			);
		}
		return { period, timeZone };
	}
	const scalar =
		field.type === 'instant'
			? parseInstant(value, label, timeZone)
			: parseScalar(value, field, label);
	if (field.type === 'enum' && (operator === 'eq' || operator === 'neq')) {
		if (typeof scalar !== 'string' || !field.options?.includes(scalar)) {
			throw new LeadFilterExpressionError(`'${label}' must match an option of '${field.label}'.`);
		}
	}
	return scalar;
}

/** Compiles the n8n Filter Groups fixed collection into the API's v1 expression. */
export function buildLeadFilterExpression(
	input: unknown,
	catalog: LeadFilterField[],
	timeZone: string,
): IDataObject {
	const fields = new Map(catalog.map((field) => [field.id, field]));
	const groups = validatedCollectionItems(input, 'group', 'Filter Groups', 'group');
	if (groups.length === 0)
		throw new LeadFilterExpressionError("Add at least one 'Filter Groups' entry.");

	const compiledGroups = groups.map((group, groupIndex) => {
		const conditions = validatedCollectionItems(
			group.conditions,
			'condition',
			`Filter Groups group ${groupIndex + 1}`,
			'condition',
		);
		if (conditions.length === 0) {
			throw new LeadFilterExpressionError(
				`Add at least one condition to Filter Groups group ${groupIndex + 1}.`,
			);
		}
		const items = conditions.flatMap((condition, conditionIndex) => {
			const fieldId = readText(condition.field);
			const field = fields.get(fieldId);
			if (!field || !filterIdentifierIsValid(field.id)) {
				throw new LeadFilterExpressionError(
					`Filter Groups group ${groupIndex + 1}, condition ${conditionIndex + 1} has an unknown Field '${fieldId}'. Refresh the field list and choose a field from the list.`,
				);
			}
			const operator = readText(condition.operator) as LeadFilterOperator;
			if (!field.operators.includes(operator)) {
				throw new LeadFilterExpressionError(
					`Operator '${operator || '(empty)'}' is not valid for ${TYPE_LABELS[field.type]} field '${field.label}'. Choose an operator offered for this field.`,
				);
			}
			const value = parseOperand(condition, field, operator, groupIndex, conditionIndex, timeZone);
			return compileCondition(field, operator, value);
		});
		return { kind: 'all', items };
	});

	const expression: IDataObject = {
		contract: 'newar.filter',
		version: 1,
		root: 'leads',
		where: { kind: 'any', items: compiledGroups },
	};
	const size = expressionSize(expression.where);
	if (size.nodes > MAX_FILTER_EXPRESSION_NODES) {
		throw new LeadFilterExpressionError(
			`Filter Groups exceeds Newar's limit of ${MAX_FILTER_EXPRESSION_NODES} expression nodes after custom-field guards. Remove some conditions.`,
		);
	}
	if (size.maxDepth > MAX_FILTER_EXPRESSION_DEPTH) {
		throw new LeadFilterExpressionError(
			`Filter Groups exceeds Newar's limit of ${MAX_FILTER_EXPRESSION_DEPTH} expression levels. Remove some nested conditions.`,
		);
	}
	const astUnits = expressionAstUnits(expression);
	if (astUnits === null) {
		throw new LeadFilterExpressionError(
			'Filter Groups contains invalid Unicode or JSON data. Remove it before searching.',
		);
	}
	if (astUnits > MAX_FILTER_EXPRESSION_AST_UNITS) {
		throw new LeadFilterExpressionError(
			`Filter Groups exceeds Newar's limit of ${MAX_FILTER_EXPRESSION_AST_UNITS.toLocaleString('en-US')} AST units. Shorten long values or remove list entries.`,
		);
	}
	const serialized = JSON.stringify(expression);
	const wireBytes = serialized === undefined ? null : filterTextByteLength(serialized);
	if (wireBytes === null) {
		throw new LeadFilterExpressionError(
			'Filter Groups contains invalid Unicode or JSON data. Remove it before searching.',
		);
	}
	if (wireBytes > MAX_FILTER_EXPRESSION_WIRE_BYTES) {
		throw new LeadFilterExpressionError(
			`Filter Groups exceeds Newar's limit of ${MAX_FILTER_EXPRESSION_WIRE_BYTES.toLocaleString('en-US')} UTF-8 bytes. Shorten long values or remove list entries.`,
		);
	}
	return expression;
}
