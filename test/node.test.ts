import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { router } from '../nodes/Newar/actions/router';
import { Newar } from '../nodes/Newar/Newar.node';
import {
	apiError,
	DEAL_ID,
	executeContext,
	LEAD_ID,
	locator,
	ok,
	USER_ID,
	type Responder,
} from './support/context';

const LEAD = {
	id: LEAD_ID,
	name: 'Ana Souza',
	email: 'ana@example.com',
	phone: '5500999990000',
	emails: [],
	phones: [],
	company: 'Colégio Sol',
	owner_id: USER_ID,
	pipeline_id: null,
	stage_id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
	source: 'api',
	score: 72,
	value_estimate: 18500,
	next_step: null,
	next_step_due: null,
	observations: null,
	custom_fields: { alunos: 850 },
	tag_ids: [],
	utm: {},
	created_at: '2026-09-24T13:45:00.000Z',
	updated_at: '2026-09-24T13:45:00.000Z',
};

function createLeadParameters(extra: IDataObject = {}): IDataObject {
	return {
		resource: 'lead',
		operation: 'create',
		name: 'Ana Souza',
		additionalFields: {
			email: 'ana@example.com',
			ownerId: USER_ID,
			nextStepDue: '2026-09-30T00:00:00',
		},
		leadCustomFields: {
			mappingMode: 'defineBelow',
			value: { alunos: '850', segmento: null },
			schema: [
				{ id: 'alunos', type: 'number' },
				{ id: 'segmento', type: 'options' },
			],
		},
		options: {},
		...extra,
	};
}

function headersOf(request: IHttpRequestOptions): Record<string, string> {
	return (request.headers ?? {}) as Record<string, string>;
}

async function run(parameters: IDataObject | IDataObject[], respond: Responder, extra = {}) {
	const { context, requests } = executeContext({ parameters, respond, ...extra });
	const output = await router.call(context);
	return { output: output[0], requests };
}

describe('Newar node description', () => {
	it('offers 34 operations across 11 resources', () => {
		const node = new Newar();

		const operations = node.description.properties.filter(
			(property) => property.name === 'operation',
		);

		expect(operations).toHaveLength(11);
		expect(operations.reduce((total, property) => total + (property.options?.length ?? 0), 0)).toBe(
			34,
		);
	});

	it('is usable as an AI agent tool', () => {
		const node = new Newar();

		const usableAsTool = node.description.usableAsTool;

		expect(usableAsTool).toBe(true);
	});
});

describe('Lead > Create', () => {
	it('sends the mapped fields and custom fields', async () => {
		const { requests } = await run(createLeadParameters(), () => ({
			statusCode: 201,
			body: { success: true, data: LEAD },
		}));

		expect(requests[0]).toMatchObject({ method: 'POST', url: 'https://api.test/api/v1/leads' });
		expect(requests[0].body).toEqual({
			name: 'Ana Souza',
			email: 'ana@example.com',
			owner_id: USER_ID,
			next_step_due: '2026-09-30',
			custom_fields: { alunos: 850 },
		});
	});

	it('sends a derived Idempotency-Key', async () => {
		const { requests } = await run(createLeadParameters(), () => ok(LEAD));

		expect(headersOf(requests[0])['Idempotency-Key']).toMatch(/^n8n-[0-9a-f]{40}$/);
	});

	it('sends the same key when n8n retries the node', async () => {
		const first = await run(createLeadParameters(), () => ok(LEAD));

		const retry = await run(createLeadParameters(), () => ok(LEAD));

		expect(headersOf(retry.requests[0])['Idempotency-Key']).toBe(
			headersOf(first.requests[0])['Idempotency-Key'],
		);
	});

	it('sends a different key in another run of the node, as in a loop', async () => {
		const first = await run(createLeadParameters(), () => ok(LEAD));

		const nextRun = await run(createLeadParameters(), () => ok(LEAD), { runIndex: 1 });

		expect(headersOf(nextRun.requests[0])['Idempotency-Key']).not.toBe(
			headersOf(first.requests[0])['Idempotency-Key'],
		);
	});

	it('uses the idempotency key the user set, namespaced by endpoint', async () => {
		const parameters = createLeadParameters({ options: { idempotencyKey: 'crm-000123' } });

		const { requests } = await run(parameters, () => ok(LEAD));

		expect(headersOf(requests[0])['Idempotency-Key']).toBe('lead:crm-000123');
	});

	it('refuses a blank name before calling Newar', async () => {
		const parameters = createLeadParameters({ name: '   ' });
		const { context, requests } = executeContext({ parameters, respond: () => ok(LEAD) });

		await expect(router.call(context)).rejects.toThrow("'Name' is empty");
		expect(requests).toHaveLength(0);
	});
});

describe('Lead > Get', () => {
	it('returns the simplified lead by default', async () => {
		const parameters = { resource: 'lead', operation: 'get', leadId: locator(LEAD_ID) };

		const { output } = await run(parameters, () => ok(LEAD));

		expect(Object.keys(output[0].json)).toHaveLength(10);
		expect(output[0].json.custom_fields).toBeUndefined();
	});

	it('returns every field with the Raw output', async () => {
		const parameters = {
			resource: 'lead',
			operation: 'get',
			leadId: locator(LEAD_ID),
			output: 'raw',
		};

		const { output } = await run(parameters, () => ok(LEAD));

		expect(output[0].json).toEqual(LEAD);
	});

	it('links every output item to its input item', async () => {
		const parameters = { resource: 'lead', operation: 'get', leadId: locator(LEAD_ID) };

		const { output } = await run([parameters, parameters], () => ok(LEAD), { items: 2 });

		expect(output.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('refuses an ID that is not a UUID before calling Newar', async () => {
		const parameters = { resource: 'lead', operation: 'get', leadId: locator('Ana Souza') };
		const { context, requests } = executeContext({ parameters, respond: () => ok(LEAD) });

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect(requests).toHaveLength(0);
	});
});

describe('Lead > Get Many', () => {
	const parameters = {
		resource: 'lead',
		operation: 'getAll',
		returnAll: true,
		filters: { ownerId: USER_ID, source: 'site' },
		sort: { field: 'updated_at', direction: 'asc' },
		output: 'raw',
	};

	it('follows next_cursor until the list ends', async () => {
		const pages = [ok([{ id: 'a' }], 'c1'), ok([{ id: 'b' }], null)];

		const { output } = await run(parameters, () => pages.shift() ?? ok([]));

		expect(output.map((item) => item.json.id)).toEqual(['a', 'b']);
	});

	it('keeps every filter and the sort on every page', async () => {
		const pages = [ok([{ id: 'a' }], 'c1'), ok([{ id: 'b' }], null)];

		const { requests } = await run(parameters, () => pages.shift() ?? ok([]));

		expect(requests[1].qs).toEqual({
			owner_id: USER_ID,
			source: 'site',
			sort_by: 'updated_at',
			sort_direction: 'asc',
			limit: 500,
			cursor: 'c1',
		});
	});

	it('asks for exactly the limit when not returning all', async () => {
		const limited = { ...parameters, returnAll: false, limit: 50 };

		const { requests } = await run(limited, () => ok([]));

		expect(requests[0].qs).toMatchObject({ limit: 50 });
	});
});

describe('Lead > Search', () => {
	it('flattens the hits with their score', async () => {
		const parameters = {
			resource: 'lead',
			operation: 'search',
			term: 'ana',
			exactMatch: false,
			returnAll: false,
			limit: 5,
			output: 'fields',
			fields: ['name'],
		};

		const { output } = await run(parameters, () =>
			ok({ items: [{ result_score: 0.8, item: LEAD }] }),
		);

		expect(output[0].json).toEqual({ id: LEAD_ID, name: 'Ana Souza', result_score: 0.8 });
	});

	it('refuses a term shorter than Newar accepts', async () => {
		const parameters = { resource: 'lead', operation: 'search', term: 'a' };
		const { context } = executeContext({ parameters, respond: () => ok({ items: [] }) });

		await expect(router.call(context)).rejects.toThrow("'Search Term' needs at least 2 characters");
	});
});

describe('Deal > Update', () => {
	it('refuses an update with nothing to change', async () => {
		const parameters = {
			resource: 'deal',
			operation: 'update',
			dealId: locator(DEAL_ID),
			updateFields: {},
			dealCustomFieldsUpdate: { mappingMode: 'defineBelow', value: null },
		};
		const { context, requests } = executeContext({ parameters, respond: () => ok({}) });

		await expect(router.call(context)).rejects.toThrow('Nothing to update');
		expect(requests).toHaveLength(0);
	});

	it('sends a PATCH with only the fields to change', async () => {
		const parameters = {
			resource: 'deal',
			operation: 'update',
			dealId: locator(DEAL_ID),
			updateFields: { status: 'lost', closeReason: 'Chose another school' },
			dealCustomFieldsUpdate: { mappingMode: 'defineBelow', value: null },
		};

		const { requests } = await run(parameters, () => ok({ id: DEAL_ID }));

		expect(requests[0]).toMatchObject({
			method: 'PATCH',
			body: { status: 'lost', close_reason: 'Chose another school' },
		});
	});
});

describe('Note > Create', () => {
	it('adds the note to the chosen deal', async () => {
		const parameters = {
			resource: 'note',
			operation: 'create',
			parent: 'deal',
			dealId: locator(DEAL_ID),
			content: 'Call after 6 pm',
			options: {},
		};

		const { requests } = await run(parameters, () => ok({ id: 'n' }));

		expect(requests[0].body).toEqual({ deal_id: DEAL_ID, content: 'Call after 6 pm' });
	});
});

describe('Search > Search Records', () => {
	it('returns each hit with its type and score', async () => {
		const parameters = {
			resource: 'search',
			operation: 'search',
			term: 'colégio sol',
			recordTypes: ['lead', 'deal'],
			limitPerType: 10,
		};
		const hit = { type: 'lead', result_score: 1, item: { id: LEAD_ID, title: 'Ana Souza' } };

		const { output, requests } = await run(parameters, () => ok({ items: [hit] }));

		expect(requests[0].qs).toEqual({ term: 'colégio sol', item_types: 'lead,deal', limit: 10 });
		expect(output[0].json).toEqual({
			type: 'lead',
			id: LEAD_ID,
			title: 'Ana Souza',
			result_score: 1,
		});
	});
});

describe('Tag > Get Many', () => {
	it('applies the limit to the whole list Newar returns', async () => {
		const parameters = {
			resource: 'tag',
			operation: 'getAll',
			returnAll: false,
			limit: 1,
			filters: { entity: 'deal' },
		};

		const { output, requests } = await run(parameters, () => ok([{ id: 't1' }, { id: 't2' }]));

		expect(requests[0].qs).toEqual({ entity: 'deal' });
		expect(output).toHaveLength(1);
	});
});

describe('User > Get Current', () => {
	it('reads the token info from /v1/me', async () => {
		const parameters = { resource: 'user', operation: 'getCurrent' };

		const { requests } = await run(parameters, () => ok({ token: { scope: 'read-write' } }));

		expect(requests[0].url).toBe('https://api.test/api/v1/me');
	});
});

describe('errors', () => {
	it('fails the node with the English API error by default', async () => {
		const parameters = { resource: 'lead', operation: 'get', leadId: locator(LEAD_ID) };
		const { context } = executeContext({
			parameters,
			respond: () => apiError(401, 'unauthorized'),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Newar rejected the API token');
	});

	it('returns an error item and continues when Continue On Fail is on', async () => {
		const parameters = { resource: 'lead', operation: 'get', leadId: locator(LEAD_ID) };
		const responses = [apiError(404, 'not_found', 'Lead não encontrado.'), ok(LEAD)];

		const { output } = await run([parameters, parameters], () => responses.shift() ?? ok(LEAD), {
			items: 2,
			continueOnFail: true,
		});

		expect(output[0]).toMatchObject({
			json: { error: 'The lead was not found in Newar', httpCode: '404' },
			pairedItem: { item: 0 },
		});
		expect(output[1].json.id).toBe(LEAD_ID);
	});
});
