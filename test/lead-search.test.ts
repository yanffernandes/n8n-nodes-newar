import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports -- Test-only validator; Ajv is not bundled with the community node.
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import { router } from '../nodes/Newar/actions/router';
import {
	description as searchDescription,
	instagramStoredVariants,
	normalizeInstagramHandle,
} from '../nodes/Newar/actions/lead/search';
import filterExpressionSchema from './fixtures/filter-expression.schema.json';
import {
	buildLeadFilterExpression,
	leadFilterCatalog,
} from '../nodes/Newar/helpers/filterExpression';
import {
	getLeadFilterFields,
	getLeadFilterOperators,
	getLeadInstagramFields,
} from '../nodes/Newar/methods/loadOptions';
import {
	apiError,
	executeContext,
	LEAD_ID,
	loadOptionsContext,
	ok,
	type Responder,
} from './support/context';

const LEAD = { id: LEAD_ID, name: 'Ana Souza', email: 'ana@example.com', phone: '5511999990000' };

function groups(...conditionsByGroup: IDataObject[][]): IDataObject {
	return {
		group: conditionsByGroup.map((conditions) => ({
			conditions: { condition: conditions },
		})),
	};
}

function expressionStats(node: unknown, depth = 1): { nodes: number; maxDepth: number } {
	if (typeof node !== 'object' || node === null || Array.isArray(node)) {
		return { nodes: 0, maxDepth: depth };
	}
	const expression = node as IDataObject;
	if (expression.kind === 'scalar' || !Array.isArray(expression.items)) {
		return { nodes: 1, maxDepth: depth };
	}
	const children = expression.items.map((item) => expressionStats(item, depth + 1));
	return {
		nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
		maxDepth: Math.max(depth, ...children.map((child) => child.maxDepth)),
	};
}

async function runSearch(parameters: IDataObject, respond: Responder) {
	const { context, requests } = executeContext({ parameters, respond });
	const output = await router.call(context);
	return { items: output[0], requests };
}

function queryExpression(requests: IHttpRequestOptions[]): IDataObject {
	const query = requests.find((request) => request.url.endsWith('/v1/leads/query'));
	return (query?.body as IDataObject).filter_expression as IDataObject;
}

describe('Lead > Search by Contact', () => {
	it('sends all non-empty comma-separated contact values and keeps match metadata', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: ' +55 (11) 99999-0000, , 551133334444 ',
			email: ' ANA@example.com, bia@example.com ',
			instagram: '@ana, instagram.com/bia/ ',
			instagramField: 'instagram_handle',
			output: 'fields',
			fields: ['name'],
		};
		const matches = [
			{
				field: 'phone',
				value: '+55 (11) 99999-0000',
				matched_value: '5511999990000',
				source: 'primary',
			},
		];

		const { items, requests } = await runSearch(parameters, (request) => {
			if (request.url.endsWith('/v1/lead-fields')) {
				return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
			}
			if (request.url.endsWith('/v1/leads/query')) return ok([]);
			return ok({ items: [{ item: LEAD, matched_by: ['phone', 'email'], matches }] });
		});

		const match = requests.find((request) => request.url.endsWith('/v1/leads/match'));
		expect(match).toMatchObject({
			method: 'GET',
			url: 'https://api.test/api/v1/leads/match',
			qs: {
				phone: '+55 (11) 99999-0000,551133334444',
				email: 'ANA@example.com,bia@example.com',
				instagram: '@ana,instagram.com/bia/',
			},
		});
		expect(match?.qs).not.toHaveProperty('instagram_field');
		const query = requests.find((request) => request.url.endsWith('/v1/leads/query'));
		expect(query?.body).toMatchObject({ limit: 500 });
		const expression = queryExpression(requests);
		expect(expression).toEqual({
			contract: 'newar.filter',
			version: 1,
			root: 'leads',
			where: {
				kind: 'any',
				items: [
					{
						kind: 'all',
						items: [
							{
								kind: 'scalar',
								field: 'cf:instagram_handle',
								operator: 'is_present',
							},
							{
								kind: 'scalar',
								field: 'cf:instagram_handle',
								operator: 'in',
								value: instagramStoredVariants('ana'),
							},
						],
					},
					{
						kind: 'all',
						items: [
							{
								kind: 'scalar',
								field: 'cf:instagram_handle',
								operator: 'is_present',
							},
							{
								kind: 'scalar',
								field: 'cf:instagram_handle',
								operator: 'in',
								value: instagramStoredVariants('bia'),
							},
						],
					},
				],
			},
		});
		const validate = new Ajv({ allErrors: true }).compile(filterExpressionSchema);
		expect(validate(expression), JSON.stringify(validate.errors)).toBe(true);
		expect(items.map((item) => item.json)).toEqual([
			{ id: LEAD_ID, name: 'Ana Souza', matched_by: ['phone', 'email'], matches },
		]);
	});

	it('merges custom field leads after match results without duplicating ids', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: '5511999990000',
			instagram: '@ana',
			instagramField: 'instagram_handle',
			output: 'raw',
		};
		const phoneMatch = {
			field: 'phone',
			value: '5511999990000',
			matched_value: '5511999990000',
			source: 'primary',
		};
		const conversationMatch = {
			field: 'instagram',
			value: '@ana',
			matched_value: 'ana',
			source: 'instagram_conversation',
		};

		const { items } = await runSearch(parameters, (request) => {
			if (request.url.endsWith('/v1/lead-fields')) {
				return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
			}
			if (request.url.endsWith('/v1/leads/query')) {
				return ok([
					{ ...LEAD, id: 'lead-b', custom_fields: { instagram_handle: '@ana' } },
					{
						...LEAD,
						id: 'lead-c',
						custom_fields: { instagram_handle: 'https://www.instagram.com/ana/' },
					},
				]);
			}
			return ok({
				items: [
					{ item: { ...LEAD, id: 'lead-a' }, matched_by: ['phone'], matches: [phoneMatch] },
					{
						item: { ...LEAD, id: 'lead-b' },
						matched_by: ['instagram'],
						matches: [conversationMatch],
					},
				],
			});
		});

		expect(items.map((item) => item.json.id)).toEqual(['lead-a', 'lead-b', 'lead-c']);
		expect(items[1].json.matched_by).toEqual(['instagram']);
		expect(items[1].json.matches).toEqual([
			conversationMatch,
			{
				field: 'instagram',
				value: '@ana',
				matched_value: '@ana',
				source: 'custom_field',
			},
		]);
		expect(items[2].json.matched_by).toEqual(['instagram']);
		expect(items[2].json.matches).toEqual([
			{
				field: 'instagram',
				value: '@ana',
				matched_value: 'https://www.instagram.com/ana/',
				source: 'custom_field',
			},
		]);
	});

	it('applies All Filled Fields after merging the custom field matches', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: '5511999990000',
			instagram: '@ana',
			instagramField: 'instagram_handle',
			contactMatch: 'all',
			output: 'raw',
		};

		const { items } = await runSearch(parameters, (request) => {
			if (request.url.endsWith('/v1/lead-fields')) {
				return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
			}
			if (request.url.endsWith('/v1/leads/query')) {
				return ok([
					{
						...LEAD,
						id: 'phone-only',
						custom_fields: { instagram_handle: 'instagram.com/ana' },
					},
					{ ...LEAD, id: 'custom-only', custom_fields: { instagram_handle: 'ana' } },
				]);
			}
			return ok({
				items: [
					{ item: { ...LEAD, id: 'phone-only' }, matched_by: ['phone'], matches: [] },
					{ item: { ...LEAD, id: 'both' }, matched_by: ['phone', 'instagram'], matches: [] },
					{ item: { ...LEAD, id: 'insta-only' }, matched_by: ['instagram'], matches: [] },
				],
			});
		});

		expect(items.map((item) => item.json.id)).toEqual(['phone-only', 'both']);
		expect(items[0].json.matched_by).toEqual(['phone', 'instagram']);
	});

	it('reads every custom field page until the cursor ends', async () => {
		const { items, requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: 'instagram_handle',
				output: 'raw',
			},
			(request) => {
				if (request.url.endsWith('/v1/lead-fields')) {
					return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
				}
				if (request.url.endsWith('/v1/leads/query')) {
					const body = request.body as IDataObject;
					if (!body.cursor) {
						return ok(
							[{ ...LEAD, id: 'first-lead', custom_fields: { instagram_handle: 'ana' } }],
							'next-page',
						);
					}
					return ok([{ ...LEAD, id: 'second-lead', custom_fields: { instagram_handle: '@ana' } }]);
				}
				return ok({ items: [] });
			},
		);

		expect(items.map((item) => item.json.id)).toEqual(['first-lead', 'second-lead']);
		expect(requests.filter((request) => request.url.endsWith('/v1/leads/query'))).toHaveLength(2);
	});

	it('continues an Instagram custom-field search after an empty page with a cursor', async () => {
		const { items, requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: 'instagram_handle',
				output: 'raw',
			},
			(request) => {
				if (request.url.endsWith('/v1/lead-fields')) {
					return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
				}
				if (request.url.endsWith('/v1/leads/query')) {
					const body = request.body as IDataObject;
					if (!body.cursor) return ok([], 'next-page');
					return ok([{ ...LEAD, custom_fields: { instagram_handle: 'ana' } }]);
				}
				return ok({ items: [] });
			},
		);

		expect(items.map((item) => item.json.id)).toEqual([LEAD_ID]);
		expect(requests.filter((request) => request.url.endsWith('/v1/leads/query'))).toHaveLength(2);
	});

	it('fails instead of returning partial Instagram custom-field results on a repeated cursor', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: 'instagram_handle',
			},
			respond: (request) => {
				if (request.url.endsWith('/v1/lead-fields')) {
					return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
				}
				if (request.url.endsWith('/v1/leads/query')) {
					return ok([{ ...LEAD, custom_fields: { instagram_handle: 'ana' } }], 'same-cursor');
				}
				return ok({ items: [] });
			},
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('repeated pagination cursor');
		expect(requests.filter((request) => request.url.endsWith('/v1/leads/query'))).toHaveLength(2);
	});

	it('rejects Instagram query records without the selected field instead of skipping them', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: 'instagram_handle',
			},
			respond: (request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }])
					: request.url.endsWith('/v1/leads/query')
						? ok([LEAD])
						: ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain(
			'unexpected Instagram custom-field search response',
		);
	});

	it('fails when the custom field search exceeds its page cap', async () => {
		let pages = 0;
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: 'instagram_handle',
			},
			respond: (request) => {
				if (request.url.endsWith('/v1/lead-fields')) {
					return ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]);
				}
				if (request.url.endsWith('/v1/leads/query')) {
					pages += 1;
					return ok([{ ...LEAD, id: `lead-${pages}` }], `cursor-${pages}`);
				}
				return ok({ items: [] });
			},
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('more than 5000 leads');
		expect(pages).toBe(10);
	});

	it.each([['ana souza'], ['!!!'], ['a'.repeat(31)]])(
		'rejects an invalid Instagram handle (%s) before calling the API',
		async (instagram) => {
			const { context, requests } = executeContext({
				parameters: {
					resource: 'lead',
					operation: 'search',
					searchBy: 'contact',
					instagram,
					instagramField: 'instagram_handle',
				},
				respond: () => ok({ items: [] }),
			});

			const error = await router.call(context).catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(NodeOperationError);
			expect((error as NodeOperationError).message).toContain(instagram);
			expect(requests).toHaveLength(0);
		},
	);

	it('rejects a select Instagram Field instead of searching', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: 'instagram_handle',
			},
			respond: (request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([
							{
								key: 'instagram_handle',
								label: 'Instagram',
								type: 'select',
								options: ['ana'],
							},
						])
					: ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('select field');
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toContain('/v1/lead-fields');
	});

	it('skips the custom field query when Instagram Field is empty', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
			},
			() => ok({ items: [] }),
		);

		expect(requests).toHaveLength(1);
		expect(requests[0].url).toContain('/v1/leads/match');
		expect(requests[0].qs).toEqual({ instagram: '@ana' });
	});

	it('keeps only leads matching every contact field with a value', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: '5511999990000',
			email: 'ana@example.com',
			instagram: '',
			contactMatch: 'all',
			output: 'raw',
		};

		const { items } = await runSearch(parameters, () =>
			ok({
				items: [
					{ item: { ...LEAD, id: 'phone-only' }, matched_by: ['phone'], matches: [] },
					{ item: { ...LEAD, id: 'all-filled' }, matched_by: ['phone', 'email'], matches: [] },
					{ item: { ...LEAD, id: 'email-only' }, matched_by: ['email'], matches: [] },
				],
			}),
		);

		expect(items.map((item) => item.json.id)).toEqual(['all-filled']);
	});

	it('skips the custom field query when Instagram is empty', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: '5511999990000',
			instagram: '',
			instagramField: 'instagram_handle',
		};
		const { requests } = await runSearch(parameters, () => ok({ items: [] }));

		expect(requests).toHaveLength(1);
		expect(requests[0].qs).toEqual({ phone: '5511999990000' });
	});

	it('throws when the API reports that Contact results were truncated', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: '5511999990000',
		};
		const { context } = executeContext({
			parameters,
			respond: () => ({
				statusCode: 200,
				body: {
					success: true,
					data: { items: [] },
					additional_data: { truncated: true },
				},
			}),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('matched more than 100 leads');
		expect((error as NodeOperationError).description).toContain('Add more specific contact values');
	});

	it('rejects malformed Contact truncation metadata instead of assuming a complete result', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				phone: '5511999990000',
			},
			respond: () => ({
				statusCode: 200,
				body: { success: true, data: { items: [] }, additional_data: { truncated: 'true' } },
			}),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected Contact search response');
	});

	it('throws instead of turning an unexpected Contact response into no results', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: '5511999990000',
		};
		const { context } = executeContext({ parameters, respond: () => ok({}) });

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected Contact search response');
	});

	it.each([
		['lead without an ID', { item: { name: 'Ana' }, matched_by: ['phone'], matches: [] }],
		['unknown matched field', { item: LEAD, matched_by: ['company'], matches: [] }],
		[
			'malformed match detail',
			{ item: LEAD, matched_by: ['phone'], matches: [{ field: 'phone', source: 'unknown' }] },
		],
	])('rejects a Contact result with %s', async (_label, hit) => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				phone: '5511999990000',
			},
			respond: () => ok({ items: [hit] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected Contact search response');
	});

	it('refuses a contact search when every expression value is empty', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'contact',
			phone: ' , ',
			email: '',
			instagram: '  ',
			instagramField: 'instagram_handle',
		};
		const { context, requests } = executeContext({ parameters, respond: () => ok({ items: [] }) });

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as Error).message).toContain('Fill in at least one contact value');
		expect(requests).toHaveLength(0);
	});

	it('rejects non-text contact values instead of coercing them into search terms', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				phone: { value: '5511999990000' },
			},
			respond: () => ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('Phone must be text');
		expect(requests).toHaveLength(0);
	});

	it('rejects an unknown Contact Match option before requesting leads', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				phone: '5511999990000',
				contactMatch: 'every-value',
			},
			respond: () => ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('Unknown Contact Match option');
		expect(requests).toHaveLength(0);
	});

	it('rejects a non-text Instagram Field instead of silently skipping custom-field search', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'contact',
				instagram: '@ana',
				instagramField: { key: 'instagram_handle' },
			},
			respond: () => ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('Instagram Field must be text');
		expect(requests).toHaveLength(0);
	});
});

describe('Instagram handle normalization', () => {
	it.each([
		['@Ana.Souza', 'ana.souza'],
		['ANA', 'ana'],
		['instagram.com/bia/', 'bia'],
		['www.instagram.com/bia', 'bia'],
		['https://www.instagram.com/Ana/?x=1/', 'ana'],
		['http://instagram.com/c?igsh=1', 'c'],
	])('normalizes %s to %s', (input, expected) => {
		expect(normalizeInstagramHandle(input)).toBe(expected);
	});

	it.each([[''], ['ana souza'], ['!!!'], ['a'.repeat(31)]])('rejects %s', (input) => {
		expect(normalizeInstagramHandle(input)).toBeNull();
	});

	it('covers the common written forms of a handle', () => {
		expect(instagramStoredVariants('ana')).toEqual([
			'ana',
			'ana/',
			'@ana',
			'@ana/',
			'instagram.com/ana',
			'instagram.com/ana/',
			'www.instagram.com/ana',
			'www.instagram.com/ana/',
			'https://instagram.com/ana',
			'https://instagram.com/ana/',
			'https://www.instagram.com/ana',
			'https://www.instagram.com/ana/',
			'http://instagram.com/ana',
			'http://instagram.com/ana/',
			'http://www.instagram.com/ana',
			'http://www.instagram.com/ana/',
		]);
	});
});

describe('Lead > Search by Conditions', () => {
	it('rejects an unknown Search By mode instead of silently using Text', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'unknown',
				term: 'Ana',
			},
			respond: () => ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('Unknown Search By option');
		expect(requests).toHaveLength(0);
	});

	it('keeps generated expressions conformant with the shared filter contract', () => {
		// Draft-07 snapshot of the generated-expression subset of the shared v1 schema.
		// The shared runtime's size limits are checked separately by the compiler tests.
		const validate = new Ajv({ allErrors: true }).compile(filterExpressionSchema);
		const catalog = leadFilterCatalog([
			{
				key: 'qualification',
				label: 'Qualification',
				type: 'select',
				options: ['Qualified', 'New'],
			},
			{ key: 'budget', label: 'Budget', type: 'number' },
			{ key: 'segment', label: 'Segment', type: 'text' },
			{ key: 'registered_on', label: 'Registered On', type: 'date' },
		]);
		const cases: Array<[string, IDataObject]> = [
			[
				'AND within groups, OR between nested condition groups, and custom field',
				buildLeadFilterExpression(
					groups(
						[
							{ field: 'name', operator: 'contains', value: 'Ana' },
							{ field: 'cf:qualification', operator: 'eq', value: 'Qualified' },
						],
						[{ field: 'source', operator: 'eq', value: 'form' }],
					),
					catalog,
					'America/Sao_Paulo',
				),
			],
			[
				'in list',
				buildLeadFilterExpression(
					groups([{ field: 'name', operator: 'in', value: 'Ana, Bia' }]),
					catalog,
					'America/Sao_Paulo',
				),
			],
			[
				'between range',
				buildLeadFilterExpression(
					groups([{ field: 'score', operator: 'between', value: '10, 20' }]),
					catalog,
					'America/Sao_Paulo',
				),
			],
			[
				'valueless operator',
				buildLeadFilterExpression(
					groups([{ field: 'name', operator: 'is_empty', value: 'stale value' }]),
					catalog,
					'America/Sao_Paulo',
				),
			],
			[
				'custom negative and date operators',
				buildLeadFilterExpression(
					groups([
						{ field: 'cf:segment', operator: 'not_contains', value: 'X' },
						{ field: 'cf:registered_on', operator: 'before', value: '2026-10-17' },
					]),
					catalog,
					'America/Sao_Paulo',
				),
			],
			[
				'custom valueless operator',
				buildLeadFilterExpression(
					groups([{ field: 'cf:segment', operator: 'is_missing', value: 'stale value' }]),
					catalog,
					'America/Sao_Paulo',
				),
			],
		];

		for (const [name, expression] of cases) {
			expect(validate(expression), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true);
		}
	});

	it('guards missing custom values and leaves valueless operators unchanged', () => {
		const catalog = leadFilterCatalog([
			{ key: 'budget', label: 'Budget', type: 'number' },
			{ key: 'segment', label: 'Segment', type: 'text' },
		]);
		const expression = buildLeadFilterExpression(
			groups([
				{ field: 'cf:budget', operator: 'gt', value: '10' },
				{ field: 'cf:segment', operator: 'neq', value: 'X' },
				{ field: 'cf:segment', operator: 'is_missing' },
			]),
			catalog,
			'America/Sao_Paulo',
		);

		expect(expression.where).toEqual({
			kind: 'any',
			items: [
				{
					kind: 'all',
					items: [
						{ kind: 'scalar', field: 'cf:budget', operator: 'is_present' },
						{ kind: 'scalar', field: 'cf:budget', operator: 'gt', value: 10 },
						{
							kind: 'any',
							items: [
								{ kind: 'scalar', field: 'cf:segment', operator: 'is_missing' },
								{ kind: 'scalar', field: 'cf:segment', operator: 'neq', value: 'X' },
							],
						},
						{ kind: 'scalar', field: 'cf:segment', operator: 'is_missing' },
					],
				},
			],
		});
	});

	it('keeps the largest guarded expressions within the shared depth and node limits', () => {
		const validate = new Ajv({ allErrors: true }).compile(filterExpressionSchema);
		const catalog = leadFilterCatalog([{ key: 'segment', label: 'Segment', type: 'text' }]);
		const cases = [
			{ operator: 'eq', count: 49, nodes: 100, depth: 3 },
			{ operator: 'neq', count: 32, nodes: 98, depth: 4 },
		];

		for (const { operator, count, nodes, depth } of cases) {
			const conditions = Array.from({ length: count }, (_, index) => ({
				field: 'cf:segment',
				operator,
				value: `value-${index}`,
			}));
			const expression = buildLeadFilterExpression(
				groups(conditions),
				catalog,
				'America/Sao_Paulo',
			);
			const stats = expressionStats(expression.where);

			expect(stats).toEqual({ nodes, maxDepth: depth });
			expect(validate(expression), JSON.stringify(validate.errors)).toBe(true);
			expect(() =>
				buildLeadFilterExpression(
					groups([...conditions, { ...conditions[0], value: `overflow-${count}` }]),
					catalog,
					'America/Sao_Paulo',
				),
			).toThrow("exceeds Newar's limit of 100 expression nodes");
		}
	});

	it('loads custom lead fields with cf ids and only the selected field operators', async () => {
		const customFields = [
			{ key: 'budget', label: 'Budget', type: 'number', options: [] },
			{ key: 'segment', label: 'Segment', type: 'select', options: ['A', 'B'] },
		];
		const { context: fieldsContext } = loadOptionsContext({ respond: () => ok(customFields) });
		const { context: operatorsContext } = loadOptionsContext({
			respond: () => ok(customFields),
			currentParameterPath: 'parameters.filterGroups.group.0.conditions.condition.1.operator',
			currentParameters: {
				filterGroups: {
					group: [
						{
							conditions: {
								condition: [{ field: 'cf:segment' }, { field: 'cf:budget' }],
							},
						},
					],
				},
			},
		});

		const fields = await getLeadFilterFields.call(fieldsContext);
		const operators = await getLeadFilterOperators.call(operatorsContext);

		expect(fields).toContainEqual({ name: 'Budget (Custom Field)', value: 'cf:budget' });
		expect(operators.map((operator) => operator.value)).toEqual([
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
		]);
	});

	it('rejects malformed custom field catalog rows before compiling a filter', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'cf:segment', operator: 'eq', value: 'A' }]),
			},
			respond: (request) => (request.url.endsWith('/v1/lead-fields') ? ok([null]) : ok([])),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected lead field list');
	});

	it('does not reuse a failed custom field request for the next items', async () => {
		const parameter = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'conditions',
			filterGroups: groups([{ field: 'cf:segment', operator: 'eq', value: 'A' }]),
		};
		let fieldCalls = 0;
		const { context, requests } = executeContext({
			parameters: [parameter, parameter],
			items: 2,
			continueOnFail: true,
			respond: (request) => {
				if (request.url.endsWith('/v1/lead-fields')) {
					fieldCalls += 1;
					return fieldCalls === 1
						? apiError(400, 'bad_request')
						: ok([{ id: 'segment', key: 'segment', name: 'Segment', type: 'text' }]);
				}
				return ok([LEAD]);
			},
		});

		const output = await router.call(context);

		expect(requests.filter((request) => request.url.endsWith('/v1/lead-fields'))).toHaveLength(2);
		expect(output[0][0].json.error).toBeDefined();
		expect(output[0][1].json.error).toBeUndefined();
	});

	it('uses the relative sibling field dependency in the editor', () => {
		const filterGroups = searchDescription.find(
			(property) => property.name === 'filterGroups',
		) as unknown as {
			options: Array<{
				values: Array<{ name: string; options?: Array<{ values?: IDataObject[] }> }>;
			}>;
		};
		const conditions = filterGroups.options[0].values.find(
			(property) => property.name === 'conditions',
		);
		const condition = conditions?.options?.[0];
		const operator = condition?.values?.find((property) => property.name === 'operator');
		const typeOptions = operator?.typeOptions as IDataObject | undefined;

		expect(typeOptions?.loadOptionsDependsOn).toEqual(['&field']);
	});

	it('offers Name once and marks Converted as requiring the Pipeline permission', async () => {
		const { context } = loadOptionsContext({ respond: () => ok([]) });

		const fields = await getLeadFilterFields.call(context);

		expect(fields.filter((field) => field.value === 'name')).toHaveLength(1);
		expect(fields.some((field) => field.value === 'title' || field.value === 'lead_name')).toBe(
			false,
		);
		expect(fields.find((field) => field.value === 'converted')?.description).toContain(
			'Pipeline permission',
		);
	});

	it('loads lead custom fields for the optional Instagram field picker', async () => {
		const { context } = loadOptionsContext({
			respond: () => ok([{ key: 'instagram_handle', label: 'Instagram', type: 'text' }]),
		});

		const fields = await getLeadInstagramFields.call(context);

		expect(fields).toEqual([
			{ name: 'No Custom Field', value: '' },
			{ name: 'Instagram', value: 'instagram_handle' },
		]);
	});

	it('shows a useful load-options error for malformed custom field catalogs', async () => {
		const { context } = loadOptionsContext({ respond: () => ok([null]) });

		const error = await getLeadFilterFields.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected lead field list');
	});

	it('compiles AND within groups and OR between groups, including custom field ids', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'conditions',
			filterGroups: groups(
				[
					{ field: 'name', operator: 'contains', value: 'Ana' },
					{ field: 'cf:qualification', operator: 'eq', value: 'Qualified' },
				],
				[{ field: 'score', operator: 'gt', value: '70' }],
			),
			returnAll: true,
			output: 'raw',
		};
		const customFields = [
			{
				key: 'qualification',
				label: 'Qualification',
				type: 'select',
				options: ['Qualified', 'New'],
			},
		];
		const requestsSeen: IHttpRequestOptions[] = [];
		const respond: Responder = (request) => {
			requestsSeen.push(request);
			if (request.url.endsWith('/v1/lead-fields')) return ok(customFields);
			const body = request.body as IDataObject;
			if (!body.cursor) return ok([LEAD], 'next-page');
			return ok([{ ...LEAD, id: 'second-lead' }]);
		};

		const { items, requests } = await runSearch(parameters, respond);

		expect(items.map((item) => item.json.id)).toEqual([LEAD_ID, 'second-lead']);
		expect(requestsSeen).toHaveLength(3);
		expect(requestsSeen[1]).toMatchObject({
			method: 'POST',
			url: 'https://api.test/api/v1/leads/query',
			body: {
				limit: 500,
				filter_expression: {
					contract: 'newar.filter',
					version: 1,
					root: 'leads',
					where: {
						kind: 'any',
						items: [
							{
								kind: 'all',
								items: [
									{ kind: 'scalar', field: 'name', operator: 'contains', value: 'Ana' },
									{ kind: 'scalar', field: 'cf:qualification', operator: 'is_present' },
									{ kind: 'scalar', field: 'cf:qualification', operator: 'eq', value: 'Qualified' },
								],
							},
							{
								kind: 'all',
								items: [{ kind: 'scalar', field: 'score', operator: 'gt', value: 70 }],
							},
						],
					},
				},
			},
		});
		expect(requestsSeen[2].body).toMatchObject({ limit: 500, cursor: 'next-page' });
		expect(items[0].json).toEqual(LEAD);
		expect(requests).toHaveLength(3);
	});

	it('compiles one group as an AND expression', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([
					{ field: 'name', operator: 'starts_with', value: 'Ana' },
					{ field: 'score', operator: 'gte', value: '70' },
				]),
			},
			() => ok([]),
		);

		expect(queryExpression(requests)).toEqual({
			contract: 'newar.filter',
			version: 1,
			root: 'leads',
			where: {
				kind: 'any',
				items: [
					{
						kind: 'all',
						items: [
							{ kind: 'scalar', field: 'name', operator: 'starts_with', value: 'Ana' },
							{ kind: 'scalar', field: 'score', operator: 'gte', value: 70 },
						],
					},
				],
			},
		});
	});

	it.each([
		[
			'malformed group rows',
			{
				group: [
					{ conditions: { condition: [{ field: 'name', operator: 'eq', value: 'Ana' }] } },
					null,
				],
			},
			'group 2',
		],
		[
			'malformed condition rows',
			{
				group: [
					{
						conditions: {
							condition: [{ field: 'name', operator: 'eq', value: 'Ana' }, null],
						},
					},
				],
			},
			'condition 2',
		],
	])(
		'rejects %s instead of silently dropping part of the filter',
		async (_label, filterGroups, location) => {
			const { context, requests } = executeContext({
				parameters: {
					resource: 'lead',
					operation: 'search',
					searchBy: 'conditions',
					filterGroups,
				},
				respond: () => ok([]),
			});

			const error = await router.call(context).catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(NodeOperationError);
			expect((error as NodeOperationError).message).toContain(location);
			expect(requests).toHaveLength(0);
		},
	);

	it('rejects an unexpected query page shape instead of returning no results', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'eq', value: 'Ana' }]),
			},
			respond: () => ok({ items: [] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected list response');
		expect(requests).toHaveLength(1);
	});

	it('rejects a list response without a next_cursor instead of assuming it is complete', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'eq', value: 'Ana' }]),
			},
			respond: () => ({
				statusCode: 200,
				body: { success: true, data: [], additional_data: {} },
			}),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected pagination response');
	});

	it('rejects Conditions results without lead IDs instead of forwarding malformed data', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'eq', value: 'Ana' }]),
			},
			respond: () => ok([{ name: 'Ana Souza' }]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain(
			'unexpected Conditions search response',
		);
	});

	it('fails instead of returning partial conditions results when a cursor repeats', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'eq', value: 'Ana' }]),
				returnAll: true,
			},
			respond: () => ok([LEAD], 'same-cursor'),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('repeated pagination cursor');
		expect(requests).toHaveLength(2);
	});

	it.each([
		['empty string', ''],
		['blank string', '   '],
		['null', null],
		['object', { value: 'Ana' }],
	])('rejects a required empty or non-scalar Value (%s)', async (_label, value) => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'contains', value }]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('Filter Groups group 1, condition 1');
		expect((error as NodeOperationError).message).toContain('Name');
		expect(requests).toHaveLength(0);
	});

	it('rejects an in list that has no non-empty entries', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'in', value: ', ,  ' }]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('at least one value');
		expect(requests).toHaveLength(0);
	});

	it('trims in values and drops empty list entries', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'in', value: ' Ana, , Bia, ' }]),
			},
			() => ok([]),
		);

		expect(queryExpression(requests).where).toMatchObject({
			items: [{ items: [{ field: 'name', operator: 'in', value: ['Ana', 'Bia'] }] }],
		});
	});

	it('rejects an empty enum Value with its group, condition, and field', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'cf:segment', operator: 'eq', value: ' ' }]),
			},
			respond: (request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([{ key: 'segment', label: 'Segment', type: 'select', options: ['A', 'B'] }])
					: ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain(
			'group 1, condition 1 (Segment (Custom Field))',
		);
	});

	it.each(['0x10', '0b1', '1e309', 'Infinity'])(
		'rejects non-decimal numeric input %s',
		async (value) => {
			const { context, requests } = executeContext({
				parameters: {
					resource: 'lead',
					operation: 'search',
					searchBy: 'conditions',
					filterGroups: groups([{ field: 'score', operator: 'eq', value }]),
				},
				respond: () => ok([]),
			});

			const error = await router.call(context).catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(NodeOperationError);
			expect((error as NodeOperationError).message).toContain('decimal number');
			expect(requests).toHaveLength(0);
		},
	);

	it('rejects expressions over the shared AST unit budget before querying', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'contains', value: 'é'.repeat(33_000) }]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('65,536 AST units');
		expect(requests).toHaveLength(0);
	});

	it('enforces the shared UTF-8 wire limit on escaped text before querying', async () => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([
					{ field: 'name', operator: 'contains', value: 'a\n'.repeat(30_000) },
				]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('65,536 UTF-8 bytes');
		expect(requests).toHaveLength(0);
	});

	it.each(['\u0000', '\ud800'])('rejects invalid Unicode condition text (%s)', async (value) => {
		const { context, requests } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'contains', value }]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('invalid Unicode');
		expect(requests).toHaveLength(0);
	});

	it('drops any residual Value for a valueless operator', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'is_empty', value: 'stale saved value' }]),
			},
			() => ok([]),
		);

		expect(queryExpression(requests)).toEqual({
			contract: 'newar.filter',
			version: 1,
			root: 'leads',
			where: {
				kind: 'any',
				items: [
					{
						kind: 'all',
						items: [{ kind: 'scalar', field: 'name', operator: 'is_empty' }],
					},
				],
			},
		});
	});

	it('caches custom lead fields across input items', async () => {
		const parameters = Array.from({ length: 2 }, () => ({
			resource: 'lead',
			operation: 'search',
			searchBy: 'conditions',
			filterGroups: groups([{ field: 'cf:segment', operator: 'eq', value: 'A' }]),
		}));
		const { context, requests } = executeContext({
			parameters,
			items: 2,
			respond: (request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([{ key: 'segment', label: 'Segment', type: 'select', options: ['A', 'B'] }])
					: ok([]),
		});

		await router.call(context);

		expect(requests.filter((request) => request.url.endsWith('/v1/lead-fields'))).toHaveLength(1);
		expect(requests.filter((request) => request.url.endsWith('/v1/leads/query'))).toHaveLength(2);
	});

	it('reports Leads permission for a read token on the POST query endpoint', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'name', operator: 'eq', value: 'Ana' }]),
			},
			credentials: { apiToken: 'nw_r_test', baseUrl: 'https://api.test/api/' },
			respond: () => ({
				statusCode: 403,
				body: { success: false, error: { code: 'forbidden', message: 'Sem permissão.' } },
			}),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect((error as Error).message).toBe('Your Newar user is not allowed to do this');
		expect((error as NodeOperationError).description).toContain('Leads permission');
	});

	it('converts date-only instants to workflow-zone midnight and parses booleans', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([
					{ field: 'created_at', operator: 'eq', value: '2026-10-16' },
					{ field: 'converted', operator: 'eq', value: 'false' },
				]),
			},
			() => ok([]),
		);

		expect(queryExpression(requests)).toMatchObject({
			where: {
				items: [
					{
						items: [
							{
								field: 'created_at',
								operator: 'eq',
								value: '2026-10-16T03:00:00.000Z',
							},
							{ field: 'converted', operator: 'eq', value: false },
						],
					},
				],
			},
		});
	});

	it('allows equal numeric range bounds', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'score', operator: 'between', value: '10, 10' }]),
			},
			() => ok([]),
		);

		expect(queryExpression(requests).where).toMatchObject({
			items: [{ items: [{ field: 'score', operator: 'between', value: { from: 10, to: 10 } }] }],
		});
	});

	it('rejects reversed numeric range bounds', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'score', operator: 'between', value: '20, 10' }]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('less than or equal to its end value');
	});

	it('validates instant and local-date ranges and parses relative date values', async () => {
		const { requests } = await runSearch(
			{
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([
					{
						field: 'opened_at',
						operator: 'between',
						value: '2026-10-16T09:30:00-03:00, 2026-10-16T10:30:00-03:00',
					},
					{ field: 'cf:anniversary', operator: 'between', value: '2026-10-16, 2026-10-16' },
					{ field: 'cf:activated_at', operator: 'eq', value: '2026-10-16' },
					{ field: 'created_at', operator: 'older_than', value: '3 days' },
					{ field: 'created_at', operator: 'calendar_period', value: 'this_month' },
				]),
			},
			(request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([
							{ key: 'anniversary', label: 'Anniversary', type: 'date' },
							{ key: 'activated_at', label: 'Activated At', type: 'instant' },
						])
					: ok([]),
		);

		expect(queryExpression(requests)).toMatchObject({
			where: {
				items: [
					{
						items: [
							{
								field: 'opened_at',
								operator: 'between',
								value: {
									from: '2026-10-16T12:30:00.000Z',
									to: '2026-10-16T13:30:00.000Z',
								},
							},
							{
								field: 'cf:anniversary',
								operator: 'is_present',
							},
							{
								field: 'cf:anniversary',
								operator: 'between',
								value: { from: '2026-10-16', to: '2026-10-16' },
							},
							{
								field: 'cf:activated_at',
								operator: 'is_present',
							},
							{
								field: 'cf:activated_at',
								operator: 'eq',
								value: '2026-10-16T03:00:00.000Z',
							},
							{ field: 'created_at', operator: 'older_than', value: { amount: 3, unit: 'days' } },
							{
								field: 'created_at',
								operator: 'calendar_period',
								value: { period: 'this_month', timeZone: 'America/Sao_Paulo' },
							},
						],
					},
				],
			},
		});
	});

	it('rejects reversed local-date range bounds with a field label and example', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([
					{ field: 'cf:anniversary', operator: 'between', value: '2026-10-17, 2026-10-16' },
				]),
			},
			respond: (request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([{ key: 'anniversary', label: 'Anniversary', type: 'date' }])
					: ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain(
			'group 1, condition 1 (Anniversary (Custom Field))',
		);
		expect((error as NodeOperationError).message).toContain('2026-10-16, 2026-10-17');
	});

	it.each([
		['instant range with equal endpoints', '2026-10-16T09:30:00-03:00, 2026-10-16T09:30:00-03:00'],
		['instant range in reverse order', '2026-10-16T10:00:00-03:00, 2026-10-16T09:30:00-03:00'],
	])('rejects an invalid %s with a field label and example', async (_label, value) => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'created_at', operator: 'between', value }]),
			},
			respond: () => ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('group 1, condition 1 (Created At)');
		expect((error as NodeOperationError).message).toContain('Example:');
	});

	it.each([
		['missing timezone', '2026-10-16T09:30:00'],
		['hour 24', '2026-10-16T24:00:00-03:00'],
		['minute 60', '2026-10-16T09:60:00-03:00'],
		['offset minute 60', '2026-10-16T09:30:00-03:60'],
		['offset beyond the shared limit', '2026-10-16T09:30:00+16:00'],
		['too many fractional digits', '2026-10-16T09:30:00.1234567-03:00'],
		['lowercase timezone marker', '2026-10-16T09:30:00z'],
		['year zero', '0000-10-16T09:30:00Z'],
	])('rejects invalid instant value (%s) with an example', async (_label, value) => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'conditions',
			filterGroups: groups([{ field: 'created_at', operator: 'eq', value }]),
		};
		const { context } = executeContext({ parameters, respond: () => ok([]) });

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect((error as NodeOperationError).message).toContain('RFC3339 with a timezone offset');
		expect((error as NodeOperationError).message).toContain('2026-10-16T09:30:00-03:00');
	});

	it('rejects an invalid local-date value with its group, condition, field, and example', async () => {
		const { context } = executeContext({
			parameters: {
				resource: 'lead',
				operation: 'search',
				searchBy: 'conditions',
				filterGroups: groups([{ field: 'cf:anniversary', operator: 'eq', value: '2026-02-30' }]),
			},
			respond: (request) =>
				request.url.endsWith('/v1/lead-fields')
					? ok([{ key: 'anniversary', label: 'Anniversary', type: 'date' }])
					: ok([]),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect((error as NodeOperationError).message).toContain(
			'group 1, condition 1 (Anniversary (Custom Field))',
		);
		expect((error as NodeOperationError).message).toContain('Example: 2026-10-16');
	});

	it('keeps old saved search nodes in Text mode when Search By is missing', async () => {
		const { requests } = await runSearch(
			{ resource: 'lead', operation: 'search', term: 'Ana Souza' },
			() => ok({ items: [{ item: LEAD, result_score: 1 }] }),
		);

		expect(requests[0]).toMatchObject({
			method: 'GET',
			url: 'https://api.test/api/v1/leads/search',
			qs: { term: 'Ana Souza' },
		});
	});

	it.each([
		['missing the Lead object', { result_score: 0.9 }],
		['missing the score', { item: LEAD }],
		['an out-of-range score', { item: LEAD, result_score: 1.1 }],
	])('rejects a Text search response %s', async (_label, hit) => {
		const { context } = executeContext({
			parameters: { resource: 'lead', operation: 'search', term: 'Ana' },
			respond: () => ok({ items: [hit] }),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('unexpected Text search response');
	});

	it('rejects an operator that the selected field type does not accept before querying', async () => {
		const parameters: IDataObject = {
			resource: 'lead',
			operation: 'search',
			searchBy: 'conditions',
			filterGroups: groups([{ field: 'score', operator: 'contains', value: '70' }]),
		};
		const { context, requests } = executeContext({ parameters, respond: () => ok([]) });

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as Error).message).toContain(
			"Operator 'contains' is not valid for number field 'Score'",
		);
		expect(requests).toHaveLength(0);
	});

	it('maps custom field types to the API filter catalog ids', () => {
		const fields = leadFilterCatalog([
			{ key: 'budget', label: 'Budget', type: 'number', options: [] },
			{ key: 'segment', label: 'Segment', type: 'select', options: ['A', 'B'] },
		]);

		expect(fields.find((field) => field.id === 'cf:budget')).toMatchObject({
			type: 'number',
			source: 'custom',
		});
		expect(fields.find((field) => field.id === 'cf:segment')).toMatchObject({
			type: 'enum',
			options: ['A', 'B'],
		});
	});
});
