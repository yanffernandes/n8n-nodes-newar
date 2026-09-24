import type { FieldType, IDataObject, ResourceMapperField } from 'n8n-workflow';

import { toDateOnly } from './dates';

/**
 * Custom fields travel in `custom_fields`, keyed by the field's readable key
 * from `/v1/lead-fields` or `/v1/deal-fields`. Newar checks each value against
 * the field type: text, number, date (`YYYY-MM-DD`), select (the option label,
 * as written) or boolean. `null` clears a field, and an update only touches the
 * keys it sends.
 */

export type NewarFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

export interface NewarField {
	key: string;
	label: string;
	type: NewarFieldType | string;
	options?: string[];
	position?: number;
	is_favorite?: boolean;
}

export type CustomFieldMode = 'create' | 'update';

const N8N_TYPES: Record<NewarFieldType, FieldType> = {
	text: 'string',
	number: 'number',
	date: 'dateTime',
	select: 'options',
	boolean: 'boolean',
};

/** The n8n resource mapper type for a Newar field type. Unknown types fall back to text. */
export function toN8nFieldType(type: string): FieldType {
	return N8N_TYPES[type as NewarFieldType] ?? 'string';
}

/**
 * Resource mapper fields for the custom fields of a record type.
 *
 * On create every field is listed and empty ones are skipped. On update the
 * fields start hidden (`removed`), so only the ones the user adds are sent:
 * an added field left empty clears the value in Newar.
 */
export function toResourceMapperFields(
	fields: NewarField[],
	mode: CustomFieldMode,
): ResourceMapperField[] {
	return [...fields]
		.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.label.localeCompare(b.label))
		.map((field) => {
			const mapped: ResourceMapperField = {
				id: field.key,
				displayName: field.label || field.key,
				required: false,
				defaultMatch: false,
				canBeUsedToMatch: false,
				display: true,
				type: toN8nFieldType(field.type),
			};
			if (field.type === 'select') {
				mapped.options = (field.options ?? []).map((option) => ({ name: option, value: option }));
			}
			if (mode === 'update') mapped.removed = true;
			return mapped;
		});
}

export interface CustomFieldProblem {
	key: string;
	message: string;
}

export interface CoercedCustomFields {
	values: IDataObject;
	problems: CustomFieldProblem[];
}

interface SchemaEntry {
	id: string;
	type?: FieldType | string;
	removed?: boolean;
}

function isEmpty(value: unknown): boolean {
	return (
		value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
	);
}

function coerceNumber(value: unknown): number | undefined {
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (typeof value === 'string') {
		const normalized = value.trim();
		if (normalized === '') return undefined;
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value;
	if (value === 1 || value === 0) return value === 1;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['true', '1', 'yes'].includes(normalized)) return true;
		if (['false', '0', 'no'].includes(normalized)) return false;
	}
	return undefined;
}

function coerceText(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return undefined;
}

/**
 * Converts the resource mapper values to what Newar expects for each field
 * type. Empty values are skipped on create and become `null` (clear) on update.
 */
export function coerceCustomFieldValues(
	values: Record<string, unknown> | null | undefined,
	schema: SchemaEntry[] | undefined,
	mode: CustomFieldMode,
	timeZone = 'UTC',
): CoercedCustomFields {
	const result: CoercedCustomFields = { values: {}, problems: [] };
	if (!values) return result;

	const typeByKey = new Map<string, string | undefined>();
	const removedKeys = new Set<string>();
	for (const entry of schema ?? []) {
		typeByKey.set(entry.id, entry.type);
		if (entry.removed) removedKeys.add(entry.id);
	}

	for (const [key, value] of Object.entries(values)) {
		if (removedKeys.has(key)) continue;
		if (isEmpty(value)) {
			if (mode === 'update') result.values[key] = null;
			continue;
		}

		switch (typeByKey.get(key)) {
			case 'number': {
				const number = coerceNumber(value);
				if (number === undefined) result.problems.push({ key, message: 'expects a number' });
				else result.values[key] = number;
				break;
			}
			case 'boolean': {
				const bool = coerceBoolean(value);
				if (bool === undefined) result.problems.push({ key, message: 'expects true or false' });
				else result.values[key] = bool;
				break;
			}
			case 'dateTime': {
				const date = toDateOnly(value, timeZone);
				if (!date) result.problems.push({ key, message: 'expects a date such as 2026-09-30' });
				else result.values[key] = date;
				break;
			}
			default: {
				const text = coerceText(value);
				if (text === undefined) result.problems.push({ key, message: 'expects text' });
				else result.values[key] = text;
			}
		}
	}

	return result;
}
