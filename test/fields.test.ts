import { describe, expect, it } from 'vitest';

import {
	buildBody,
	buildQuery,
	InvalidParameterError,
	toList,
	type BodyField,
	type QueryField,
} from '../nodes/Newar/helpers/fields';

const ID = '0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d';
const OTHER_ID = '7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d';

const FIELDS: BodyField[] = [
	{ param: 'name', api: 'name', kind: 'text', label: 'Name' },
	{ param: 'email', api: 'email', kind: 'nullableText', label: 'Email' },
	{
		param: 'valueEstimate',
		api: 'value_estimate',
		kind: 'nullableNumber',
		label: 'Value Estimate',
	},
	{ param: 'nextStepDue', api: 'next_step_due', kind: 'date', label: 'Next Step Due Date' },
	{ param: 'dueAt', api: 'due_at', kind: 'dateTime', label: 'Due Date' },
	{ param: 'ownerId', api: 'owner_id', kind: 'nullableId', label: 'Owner' },
	{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
	{ param: 'tagIds', api: 'tag_ids', kind: 'idList', label: 'Tags' },
	{ param: 'status', api: 'status', kind: 'enum', label: 'Status' },
];

describe('buildBody', () => {
	it('maps parameter names to API fields', () => {
		const values = { email: 'ana@example.com', ownerId: ID };

		const result = buildBody(values, FIELDS, 'create');

		expect(result).toEqual({ email: 'ana@example.com', owner_id: ID });
	});

	it('leaves out fields the user did not add', () => {
		const values = {};

		const result = buildBody(values, FIELDS, 'update');

		expect(result).toEqual({});
	});

	it('skips empty values on create', () => {
		const values = { email: '', ownerId: '', tagIds: [] };

		const result = buildBody(values, FIELDS, 'create');

		expect(result).toEqual({});
	});

	it('clears an added nullable field left empty on update', () => {
		const values = { email: '', ownerId: '', nextStepDue: '' };

		const result = buildBody(values, FIELDS, 'update');

		expect(result).toEqual({ email: null, owner_id: null, next_step_due: null });
	});

	it('ignores an empty field that Newar cannot clear on update', () => {
		const values = { name: '', stageId: '', status: '' };

		const result = buildBody(values, FIELDS, 'update');

		expect(result).toEqual({});
	});

	it('sends an empty tag list on update to remove every tag', () => {
		const values = { tagIds: [] };

		const result = buildBody(values, FIELDS, 'update');

		expect(result).toEqual({ tag_ids: [] });
	});

	it('accepts tags as a comma-separated string from an expression', () => {
		const values = { tagIds: `${ID}, ${OTHER_ID}` };

		const result = buildBody(values, FIELDS, 'create');

		expect(result).toEqual({ tag_ids: [ID, OTHER_ID] });
	});

	it('converts a numeric string for a number field', () => {
		const values = { valueEstimate: '18500.50' };

		const result = buildBody(values, FIELDS, 'create');

		expect(result).toEqual({ value_estimate: 18500.5 });
	});

	it('sends a date field as YYYY-MM-DD', () => {
		const values = { nextStepDue: '2026-09-30T00:00:00' };

		const result = buildBody(values, FIELDS, 'create', 'America/Sao_Paulo');

		expect(result).toEqual({ next_step_due: '2026-09-30' });
	});

	it('sends a date-time field in UTC, read in the workflow time zone', () => {
		const values = { dueAt: '2026-09-25T14:00:00' };

		const result = buildBody(values, FIELDS, 'create', 'America/Sao_Paulo');

		expect(result).toEqual({ due_at: '2026-09-25T17:00:00.000Z' });
	});

	it('refuses an ID that is not a UUID, naming the parameter', () => {
		const values = { stageId: 'Proposal' };

		const act = () => buildBody(values, FIELDS, 'create');

		expect(act).toThrow(InvalidParameterError);
		expect(act).toThrow("'Stage' must be a Newar ID");
	});

	it('refuses a date it cannot read', () => {
		const values = { nextStepDue: 'tomorrow' };

		const act = () => buildBody(values, FIELDS, 'create');

		expect(act).toThrow("'Next Step Due Date' must be a date");
	});

	it('refuses a number it cannot read', () => {
		const values = { valueEstimate: 'lots' };

		const act = () => buildBody(values, FIELDS, 'create');

		expect(act).toThrow("'Value Estimate' must be a number");
	});
});

const FILTERS: QueryField[] = [
	{ param: 'ids', api: 'ids', kind: 'idCsv', label: 'IDs' },
	{ param: 'status', api: 'status', kind: 'csv', label: 'Status' },
	{ param: 'updatedSince', api: 'updated_since', kind: 'dateTime', label: 'Updated Since' },
	{ param: 'source', api: 'source', kind: 'text', label: 'Source' },
];

describe('buildQuery', () => {
	it('joins multi-select filters with commas', () => {
		const values = { status: ['open', 'won'] };

		const result = buildQuery(values, FILTERS);

		expect(result).toEqual({ status: 'open,won' });
	});

	it('sends date filters as RFC 3339 in UTC', () => {
		const values = { updatedSince: '2026-09-01T00:00:00' };

		const result = buildQuery(values, FILTERS, 'America/Sao_Paulo');

		expect(result).toEqual({ updated_since: '2026-09-01T03:00:00.000Z' });
	});

	it('leaves out empty filters', () => {
		const values = { status: [], source: '', ids: '' };

		const result = buildQuery(values, FILTERS);

		expect(result).toEqual({});
	});

	it('refuses more than 100 IDs', () => {
		const values = { ids: Array.from({ length: 101 }, () => ID).join(',') };

		const act = () => buildQuery(values, FILTERS);

		expect(act).toThrow("'IDs' accepts up to 100 IDs");
	});
});

describe('toList', () => {
	it('splits, trims and drops empty items', () => {
		const value = ' a, b ,,c ';

		const result = toList(value);

		expect(result).toEqual(['a', 'b', 'c']);
	});
});
