import type { IDataObject } from 'n8n-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewarTrigger } from '../nodes/NewarTrigger/NewarTrigger.node';
import { ok, pollContext, type Responder } from './support/context';

const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);

function iso(minutesFromNow: number): string {
	return new Date(NOW + minutesFromNow * 60_000).toISOString();
}

async function poll(parameters: IDataObject, respond: Responder, extra: IDataObject = {}) {
	const { context, requests, staticData } = pollContext({ parameters, respond, ...extra });
	const result = await new NewarTrigger().poll.call(context);
	return { result, requests, staticData };
}

describe('NewarTrigger.poll', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('emits nothing and remembers the time on its first poll', async () => {
		const parameters = { event: 'leadCreated', filters: {} };

		const { result, requests, staticData } = await poll(parameters, () => ok([]));

		expect(result).toBeNull();
		expect(requests).toHaveLength(0);
		expect(staticData).toMatchObject({ event: 'leadCreated', cursor: iso(0), floor: iso(0) });
	});

	it('asks for changes since the cursor minus the overlap, oldest first', async () => {
		const first = await poll({ event: 'dealWon', filters: {} }, () => ok([]));

		const { requests } = await poll({ event: 'dealWon', filters: {} }, () => ok([]), {
			staticData: first.staticData,
		});

		expect(requests[0].qs).toEqual({
			status: 'won',
			updated_since: iso(-2),
			sort_by: 'updated_at',
			sort_direction: 'asc',
			limit: 500,
		});
	});

	it('emits the new event and moves the cursor', async () => {
		const first = await poll({ event: 'leadCreated', filters: {} }, () => ok([]));
		const lead = { id: 'a', created_at: iso(1), updated_at: iso(1) };

		const second = await poll({ event: 'leadCreated', filters: {} }, () => ok([lead]), {
			staticData: first.staticData,
		});

		expect(second.result).toEqual([[{ json: lead }]]);
		expect(second.staticData.cursor).toBe(iso(1));
	});

	it('does not emit the same event on the next poll', async () => {
		const first = await poll({ event: 'leadCreated', filters: {} }, () => ok([]));
		const lead = { id: 'a', created_at: iso(1), updated_at: iso(1) };
		const second = await poll({ event: 'leadCreated', filters: {} }, () => ok([lead]), {
			staticData: first.staticData,
		});

		const third = await poll({ event: 'leadCreated', filters: {} }, () => ok([lead]), {
			staticData: second.staticData,
		});

		expect(third.result).toBeNull();
	});

	it('sends the filters to Newar', async () => {
		const first = await poll({ event: 'dealStageChanged', filters: {} }, () => ok([]));
		const stageId = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

		const { requests } = await poll(
			{ event: 'dealStageChanged', filters: { stageId } },
			() => ok([]),
			{ staticData: first.staticData },
		);

		expect(requests[0].qs).toMatchObject({ stage_id: stageId });
	});

	it('starts fresh when the event changes', async () => {
		const first = await poll({ event: 'leadCreated', filters: {} }, () => ok([]));

		const second = await poll({ event: 'taskCreated', filters: {} }, () => ok([]), {
			staticData: first.staticData,
		});

		expect(second.requests).toHaveLength(0);
		expect(second.staticData.event).toBe('taskCreated');
	});

	it('returns the most recent matching record in manual mode', async () => {
		const deal = {
			id: 'd',
			status: 'won',
			created_at: iso(-60),
			updated_at: iso(-1),
			closed_at: iso(-1),
		};

		const { result, requests, staticData } = await poll(
			{ event: 'dealWon', filters: {} },
			() => ok([deal]),
			{
				mode: 'manual',
			},
		);

		expect(result).toEqual([[{ json: deal }]]);
		expect(requests[0].qs).toMatchObject({
			status: 'won',
			sort_by: 'updated_at',
			sort_direction: 'desc',
		});
		expect(staticData).toEqual({});
	});

	it('reads notes newest first and stops at the window', async () => {
		const first = await poll({ event: 'noteCreated', filters: {} }, () => ok([]));
		const pages = [
			ok(
				[
					{ id: 'n2', created_at: iso(2) },
					{ id: 'old', created_at: iso(-10) },
				],
				'c1',
			),
			ok([{ id: 'older', created_at: iso(-20) }], null),
		];

		const second = await poll(
			{ event: 'noteCreated', filters: {} },
			() => pages.shift() ?? ok([]),
			{
				staticData: first.staticData,
			},
		);

		expect(second.requests).toHaveLength(1);
		expect(second.result).toEqual([[{ json: { id: 'n2', created_at: iso(2) } }]]);
	});
});
