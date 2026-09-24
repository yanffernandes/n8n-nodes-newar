import { describe, expect, it } from 'vitest';

import { getLeadDeals, getStages } from '../nodes/Newar/methods/loadOptions';
import { getLeadCustomFields } from '../nodes/Newar/methods/resourceMapping';
import {
	searchLeads,
	searchStages,
	searchTasks,
	searchUsers,
} from '../nodes/Newar/methods/listSearch';
import { LEAD_ID, loadOptionsContext, locator, ok } from './support/context';

const PIPELINES = [
	{
		id: 'p1',
		name: 'Enrollment',
		stages: [
			{ id: 's1', pipeline_id: 'p1', name: 'New', type: 'open' },
			{ id: 's2', pipeline_id: 'p1', name: 'Enrolled', type: 'won' },
		],
	},
	{
		id: '7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d',
		name: 'Partners',
		stages: [
			{
				id: 's3',
				pipeline_id: '7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d',
				name: 'Talking',
				type: 'open',
			},
		],
	},
];

describe('searchLeads', () => {
	it('searches Newar once the filter has two characters', async () => {
		const { context, requests } = loadOptionsContext({ respond: () => ok({ items: [] }) });

		await searchLeads.call(context, 'an', 'cursor-1');

		expect(requests[0].url).toBe('https://api.test/api/v1/leads/search');
		expect(requests[0].qs).toEqual({ term: 'an', limit: 50, cursor: 'cursor-1' });
	});

	it('lists the most recently updated leads without a filter', async () => {
		const { context, requests } = loadOptionsContext({ respond: () => ok([]) });

		await searchLeads.call(context);

		expect(requests[0].url).toBe('https://api.test/api/v1/leads');
		expect(requests[0].qs).toEqual({ sort_by: 'updated_at', sort_direction: 'desc', limit: 50 });
	});

	it('names each lead with a contact detail and links it to the app', async () => {
		const lead = { id: LEAD_ID, name: 'Ana Souza', email: 'ana@example.com' };
		const { context } = loadOptionsContext({ respond: () => ok([lead], 'next') });

		const result = await searchLeads.call(context);

		expect(result).toEqual({
			results: [
				{
					name: 'Ana Souza (ana@example.com)',
					value: LEAD_ID,
					url: `https://app.newar.com.br/leads/${LEAD_ID}`,
				},
			],
			paginationToken: 'next',
		});
	});
});

describe('searchTasks', () => {
	it('uses the global search for filters of three or more characters', async () => {
		const { context, requests } = loadOptionsContext({
			respond: () => ok({ items: [{ type: 'task', item: { id: 't1', title: 'Call Ana' } }] }),
		});

		const result = await searchTasks.call(context, 'call');

		expect(requests[0].qs).toEqual({ term: 'call', item_types: 'task', limit: 30 });
		expect(result.results).toEqual([{ name: 'Call Ana', value: 't1' }]);
	});
});

describe('searchStages', () => {
	it('prefixes stages with their pipeline when no pipeline is chosen', async () => {
		const { context } = loadOptionsContext({ respond: () => ok(PIPELINES) });

		const result = await searchStages.call(context);

		expect(result.results.map((stage) => stage.name)).toEqual([
			'Enrollment > New',
			'Enrollment > Enrolled (won)',
			'Partners > Talking',
		]);
	});

	it('lists only the stages of the pipeline chosen in the node', async () => {
		const { context } = loadOptionsContext({
			respond: () => ok(PIPELINES),
			currentParameters: { filters: { pipelineId: '7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d' } },
		});

		const result = await getStages.call(context);

		expect(result).toEqual([{ name: 'Talking', value: 's3' }]);
	});
});

describe('searchUsers', () => {
	it('labels users with name and email and filters by either', async () => {
		const users = [
			{ id: 'u1', name: 'Kawã Lima', email: 'kawa@example.com' },
			{ id: 'u2', name: null, email: 'bia@example.com' },
		];
		const { context } = loadOptionsContext({ respond: () => ok(users) });

		const result = await searchUsers.call(context, 'bia');

		expect(result.results).toEqual([{ name: 'bia@example.com', value: 'u2' }]);
	});
});

describe('getLeadDeals', () => {
	it('lists nothing until a lead is chosen', async () => {
		const { context, requests } = loadOptionsContext({ respond: () => ok([]) });

		const result = await getLeadDeals.call(context);

		expect(result).toEqual([]);
		expect(requests).toHaveLength(0);
	});

	it('lists the deals of the chosen lead', async () => {
		const { context, requests } = loadOptionsContext({
			respond: () => ok([{ id: 'd1', title: '2027 enrollment', status: 'won' }]),
			currentParameters: { leadId: locator(LEAD_ID) },
		});

		const result = await getLeadDeals.call(context);

		expect(requests[0].qs).toMatchObject({ lead_id: LEAD_ID });
		expect(result).toEqual([{ name: '2027 enrollment [won]', value: 'd1' }]);
	});
});

describe('getLeadCustomFields', () => {
	const FIELDS = [{ key: 'alunos', label: 'Alunos', type: 'number', options: [], position: 1 }];

	it('shows every field when creating', async () => {
		const { context } = loadOptionsContext({
			respond: () => ok(FIELDS),
			currentParameters: { operation: 'create' },
		});

		const result = await getLeadCustomFields.call(context);

		expect(result.fields[0]).toMatchObject({ id: 'alunos', type: 'number' });
		expect(result.fields[0].removed).toBeUndefined();
	});

	it('hides every field until added when updating', async () => {
		const { context } = loadOptionsContext({
			respond: () => ok(FIELDS),
			currentParameters: { operation: 'update' },
		});

		const result = await getLeadCustomFields.call(context);

		expect(result.fields[0].removed).toBe(true);
	});

	it('reads the lead fields endpoint', async () => {
		const { context, requests } = loadOptionsContext({ respond: () => ok([]) });

		await getLeadCustomFields.call(context);

		expect(requests[0].url).toBe('https://api.test/api/v1/lead-fields');
	});
});
