import type { IDataObject } from 'n8n-workflow';

import { toDateOnly, toIsoDateTime } from './dates';

/**
 * Maps n8n parameters to Newar request bodies and query strings.
 *
 * Create skips empty values. Update treats a field the user added but left
 * empty as "clear it" (`null`) when Newar allows clearing, and ignores it
 * otherwise, so an update only changes what the user asked for.
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BodyFieldKind =
	| 'text'
	| 'nullableText'
	| 'nullableNumber'
	| 'date'
	| 'dateTime'
	| 'id'
	| 'nullableId'
	| 'idList'
	| 'enum';

export interface BodyField {
	/** Parameter name in the n8n collection. */
	param: string;
	/** Property name in the Newar request body. */
	api: string;
	kind: BodyFieldKind;
	/** Parameter label, for error messages. */
	label: string;
}

export type WriteMode = 'create' | 'update';

/** A parameter value Newar would refuse. The message names the parameter. */
export class InvalidParameterError extends Error {
	constructor(
		readonly parameter: string,
		message: string,
		readonly description?: string,
	) {
		super(message);
		this.name = 'InvalidParameterError';
	}
}

function isEmpty(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		(typeof value === 'string' && value.trim() === '') ||
		(Array.isArray(value) && value.length === 0)
	);
}

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function toId(value: unknown, label: string): string {
	const text = typeof value === 'string' ? value.trim() : String(value);
	if (!UUID_PATTERN.test(text)) {
		throw new InvalidParameterError(
			label,
			`'${label}' must be a Newar ID`,
			`Newar IDs are UUIDs such as 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d. Got '${text}'.`,
		);
	}
	return text.toLowerCase();
}

/** Accepts an array or a comma-separated string and returns trimmed, non-empty items. */
export function toList(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value];
	return raw
		.map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
		.filter((item) => item !== '');
}

function toNumber(value: unknown, label: string): number {
	const number = typeof value === 'number' ? value : Number(String(value).trim());
	if (!Number.isFinite(number)) {
		throw new InvalidParameterError(
			label,
			`'${label}' must be a number`,
			`Got '${String(value)}'.`,
		);
	}
	return number;
}

function convert(value: unknown, field: BodyField, timeZone: string): string | number | string[] {
	switch (field.kind) {
		case 'text':
		case 'nullableText':
		case 'enum':
			return typeof value === 'string' ? value : String(value);
		case 'nullableNumber':
			return toNumber(value, field.label);
		case 'date': {
			const date = toDateOnly(value, timeZone);
			if (!date) {
				throw new InvalidParameterError(
					field.label,
					`'${field.label}' must be a date`,
					`Use a date such as 2026-09-30. Got '${String(value)}'.`,
				);
			}
			return date;
		}
		case 'dateTime': {
			const dateTime = toIsoDateTime(value, timeZone);
			if (!dateTime) {
				throw new InvalidParameterError(
					field.label,
					`'${field.label}' must be a date and time`,
					`Use a date such as 2026-09-30T14:00:00 (read in the workflow time zone) or an ISO 8601 value with an offset. Got '${String(value)}'.`,
				);
			}
			return dateTime;
		}
		case 'id':
		case 'nullableId':
			return toId(value, field.label);
		case 'idList':
			return toList(value).map((id) => toId(id, field.label));
	}
}

function canClear(kind: BodyFieldKind): boolean {
	return kind !== 'text' && kind !== 'id' && kind !== 'enum';
}

/** Builds a request body from a collection of optional fields. */
export function buildBody(
	values: IDataObject,
	fields: BodyField[],
	mode: WriteMode,
	timeZone = 'UTC',
): IDataObject {
	const body: IDataObject = {};
	for (const field of fields) {
		if (!(field.param in values)) continue;
		const value = values[field.param];
		if (field.kind === 'idList') {
			const ids = convert(value ?? [], field, timeZone) as string[];
			if (ids.length > 0 || mode === 'update') body[field.api] = ids;
			continue;
		}
		if (isEmpty(value)) {
			if (mode === 'update' && canClear(field.kind)) body[field.api] = null;
			continue;
		}
		body[field.api] = convert(value, field, timeZone);
	}
	return body;
}

export type QueryFieldKind = 'text' | 'id' | 'idCsv' | 'csv' | 'dateTime';

export interface QueryField {
	param: string;
	api: string;
	kind: QueryFieldKind;
	label: string;
}

/** Builds a query string from a collection of filters. Empty filters are left out. */
export function buildQuery(
	values: IDataObject,
	fields: QueryField[],
	timeZone = 'UTC',
): IDataObject {
	const query: IDataObject = {};
	for (const field of fields) {
		const value = values[field.param];
		if (isEmpty(value)) continue;
		switch (field.kind) {
			case 'text':
				query[field.api] = String(value).trim();
				break;
			case 'id':
				query[field.api] = toId(value, field.label);
				break;
			case 'idCsv': {
				const ids = toList(value).map((id) => toId(id, field.label));
				if (ids.length > 100) {
					throw new InvalidParameterError(
						field.label,
						`'${field.label}' accepts up to 100 IDs`,
						`Got ${ids.length}. Split the list across several items.`,
					);
				}
				if (ids.length > 0) query[field.api] = ids.join(',');
				break;
			}
			case 'csv': {
				const list = toList(value);
				if (list.length > 0) query[field.api] = list.join(',');
				break;
			}
			case 'dateTime': {
				const dateTime = toIsoDateTime(value, timeZone);
				if (!dateTime) {
					throw new InvalidParameterError(
						field.label,
						`'${field.label}' must be a date and time`,
						`Got '${String(value)}'.`,
					);
				}
				query[field.api] = dateTime;
				break;
			}
		}
	}
	return query;
}
