import { describe, expect, it } from 'vitest';

import {
	coerceCustomFieldValues,
	toN8nFieldType,
	toResourceMapperFields,
	type NewarField,
} from '../nodes/Newar/helpers/customFields';

const FIELDS: NewarField[] = [
	{ key: 'alunos', label: 'Alunos', type: 'number', options: [], position: 2 },
	{
		key: 'segmento',
		label: 'Segmento',
		type: 'select',
		options: ['Escola particular', 'Faculdade'],
		position: 1,
	},
];

const SCHEMA = [
	{ id: 'alunos', type: 'number' },
	{ id: 'bolsa', type: 'boolean' },
	{ id: 'visita', type: 'dateTime' },
	{ id: 'segmento', type: 'options' },
	{ id: 'origem', type: 'string' },
];

describe('toN8nFieldType', () => {
	it.each([
		['text', 'string'],
		['number', 'number'],
		['date', 'dateTime'],
		['select', 'options'],
		['boolean', 'boolean'],
		['something-new', 'string'],
	])('maps the Newar type %s to %s', (newarType, n8nType) => {
		const result = toN8nFieldType(newarType);

		expect(result).toBe(n8nType);
	});
});

describe('toResourceMapperFields', () => {
	it('orders fields as Newar positions them', () => {
		const fields = FIELDS;

		const result = toResourceMapperFields(fields, 'create');

		expect(result.map((field) => field.id)).toEqual(['segmento', 'alunos']);
	});

	it('offers select options with the label as the value sent', () => {
		const fields = FIELDS;

		const [segmento] = toResourceMapperFields(fields, 'create');

		expect(segmento.options).toEqual([
			{ name: 'Escola particular', value: 'Escola particular' },
			{ name: 'Faculdade', value: 'Faculdade' },
		]);
	});

	it('shows every field on create', () => {
		const fields = FIELDS;

		const result = toResourceMapperFields(fields, 'create');

		expect(result.every((field) => field.removed === undefined)).toBe(true);
	});

	it('starts every field hidden on update, so only added fields are sent', () => {
		const fields = FIELDS;

		const result = toResourceMapperFields(fields, 'update');

		expect(result.every((field) => field.removed === true)).toBe(true);
	});

	it('never marks a custom field as required or matchable', () => {
		const fields = FIELDS;

		const result = toResourceMapperFields(fields, 'create');

		expect(result.some((field) => field.required || field.canBeUsedToMatch)).toBe(false);
	});
});

describe('coerceCustomFieldValues', () => {
	it('converts a numeric string for a number field', () => {
		const values = { alunos: '850' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.values).toEqual({ alunos: 850 });
	});

	it('reports a number field that is not a number', () => {
		const values = { alunos: 'many' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.problems).toEqual([{ key: 'alunos', message: 'expects a number' }]);
	});

	it('converts yes-like text for a boolean field', () => {
		const values = { bolsa: 'true' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.values).toEqual({ bolsa: true });
	});

	it('sends a date field as YYYY-MM-DD', () => {
		const values = { visita: '2026-09-30T14:00:00' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.values).toEqual({ visita: '2026-09-30' });
	});

	it('reads a Luxon-like DateTime for a date field', () => {
		const values = {
			visita: { toISO: () => '2026-09-30T00:00:00.000-03:00', toISODate: () => '2026-09-30' },
		};

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.values).toEqual({ visita: '2026-09-30' });
	});

	it('sends a select field as its label', () => {
		const values = { segmento: 'Faculdade' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.values).toEqual({ segmento: 'Faculdade' });
	});

	it('skips empty values on create', () => {
		const values = { alunos: null, origem: '' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result.values).toEqual({});
	});

	it('clears empty values on update', () => {
		const values = { alunos: null, origem: '' };

		const result = coerceCustomFieldValues(values, SCHEMA, 'update');

		expect(result.values).toEqual({ alunos: null, origem: null });
	});

	it('ignores fields the user removed from the mapper', () => {
		const values = { alunos: 10 };
		const schema = [{ id: 'alunos', type: 'number', removed: true }];

		const result = coerceCustomFieldValues(values, schema, 'update');

		expect(result.values).toEqual({});
	});

	it('returns nothing when the mapper has no value', () => {
		const values = null;

		const result = coerceCustomFieldValues(values, SCHEMA, 'create');

		expect(result).toEqual({ values: {}, problems: [] });
	});
});
