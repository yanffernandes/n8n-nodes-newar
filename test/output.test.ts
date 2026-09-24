import { describe, expect, it } from 'vitest';

import {
	applyOutput,
	flattenSearchHit,
	RECORD_FIELDS,
	SIMPLIFIED_FIELDS,
} from '../nodes/Newar/helpers/output';

const LEAD = Object.fromEntries(RECORD_FIELDS.lead.map((field) => [field, `${field}-value`]));

describe('applyOutput', () => {
	it('keeps every field in raw mode', () => {
		const record = LEAD;

		const result = applyOutput(record, 'lead', 'raw');

		expect(result).toBe(record);
	});

	it('keeps at most 10 fields in simplified mode', () => {
		const record = LEAD;

		const result = applyOutput(record, 'lead', 'simplified');

		expect(Object.keys(result)).toEqual(SIMPLIFIED_FIELDS.lead);
	});

	it.each(['lead', 'deal', 'task'] as const)(
		'simplifies %s records to 10 fields or fewer',
		(entity) => {
			const fields = SIMPLIFIED_FIELDS[entity];

			const allKnown = fields.every((field) => RECORD_FIELDS[entity].includes(field));

			expect(fields.length).toBeLessThanOrEqual(10);
			expect(allKnown).toBe(true);
		},
	);

	it('always adds the ID to the selected fields', () => {
		const record = LEAD;

		const result = applyOutput(record, 'lead', 'fields', ['email']);

		expect(result).toEqual({ id: 'id-value', email: 'email-value' });
	});

	it('leaves out selected fields the record does not have', () => {
		const record = { id: '1', name: 'Ana' };

		const result = applyOutput(record, 'lead', 'fields', ['name', 'custom_fields']);

		expect(result).toEqual({ id: '1', name: 'Ana' });
	});
});

describe('flattenSearchHit', () => {
	it('puts the relevance score next to the record fields', () => {
		const hit = { result_score: 0.8, item: { id: '1', name: 'Ana' } };

		const result = flattenSearchHit(hit);

		expect(result).toEqual({ id: '1', name: 'Ana', result_score: 0.8 });
	});

	it('shapes the record before adding the score', () => {
		const hit = { result_score: 1, item: { id: '1', name: 'Ana', email: 'a@b.c' } };

		const result = flattenSearchHit(hit, (item) => ({ id: item.id }));

		expect(result).toEqual({ id: '1', result_score: 1 });
	});
});
