import { describe, expect, it } from 'vitest';

import {
	EVENTS,
	initialState,
	isPollState,
	MAX_SEEN_KEYS,
	OVERLAP_MS,
	pickSample,
	processRecords,
	pruneSeen,
	reachedWindowStart,
	windowStart,
	type PollState,
} from '../nodes/NewarTrigger/polling';

const ACTIVATED_AT = Date.UTC(2026, 8, 24, 12, 0, 0);

function at(minutesAfterActivation: number): string {
	return new Date(ACTIVATED_AT + minutesAfterActivation * 60_000).toISOString();
}

function lead(id: string, createdMinute: number, updatedMinute = createdMinute) {
	return { id, name: `Lead ${id}`, created_at: at(createdMinute), updated_at: at(updatedMinute) };
}

function stateFor(event: keyof typeof EVENTS, cursorMinute = 0): PollState {
	return { ...initialState(event, ACTIVATED_AT), cursor: at(cursorMinute) };
}

describe('initialState', () => {
	it('starts the cursor and the floor at the activation time', () => {
		const now = ACTIVATED_AT;

		const state = initialState('leadCreated', now);

		expect(state).toEqual({
			version: 1,
			event: 'leadCreated',
			cursor: at(0),
			floor: at(0),
			seen: {},
		});
	});
});

describe('isPollState', () => {
	it('accepts the state saved for the same event', () => {
		const state = initialState('dealWon', ACTIVATED_AT);

		const result = isPollState({ ...state }, 'dealWon');

		expect(result).toBe(true);
	});

	it('rejects the state of another event, so switching events starts fresh', () => {
		const state = initialState('dealWon', ACTIVATED_AT);

		const result = isPollState({ ...state }, 'dealLost');

		expect(result).toBe(false);
	});

	it('rejects empty static data on first activation', () => {
		const staticData = {};

		const result = isPollState(staticData, 'leadCreated');

		expect(result).toBe(false);
	});
});

describe('windowStart', () => {
	it('reads from two minutes before the cursor', () => {
		const state = stateFor('leadUpdated', 10);

		const result = windowStart(state);

		expect(Date.parse(result)).toBe(Date.parse(at(10)) - OVERLAP_MS);
	});
});

describe('processRecords', () => {
	it('emits a lead created after activation', () => {
		const records = [lead('a', 1)];

		const { emitted } = processRecords(stateFor('leadCreated'), records, EVENTS.leadCreated);

		expect(emitted.map((record) => record.id)).toEqual(['a']);
	});

	it('ignores changes made before activation', () => {
		const records = [lead('old', -1)];

		const { emitted } = processRecords(stateFor('leadCreated'), records, EVENTS.leadCreated);

		expect(emitted).toEqual([]);
	});

	it('does not emit the same lead twice across polls', () => {
		const records = [lead('a', 1, 2)];
		const first = processRecords(stateFor('leadCreated'), records, EVENTS.leadCreated);

		const second = processRecords(first.state, records, EVENTS.leadCreated);

		expect(second.emitted).toEqual([]);
	});

	it('emits a record committed late, inside the overlap window', () => {
		const state = stateFor('leadCreated', 10);
		const records = [lead('late', 9)];

		const { emitted } = processRecords(state, records, EVENTS.leadCreated);

		expect(emitted.map((record) => record.id)).toEqual(['late']);
	});

	it('ignores a record older than the overlap window', () => {
		const state = stateFor('leadCreated', 10);
		const records = [lead('stale', 7, 11)];

		const { emitted } = processRecords(state, records, EVENTS.leadCreated);

		expect(emitted).toEqual([]);
	});

	it('moves the cursor to the latest updated_at read', () => {
		const records = [lead('a', 1, 3), lead('b', 2, 5)];

		const { state } = processRecords(stateFor('leadCreated'), records, EVENTS.leadCreated);

		expect(state.cursor).toBe(at(5));
	});

	it('never moves the cursor backwards', () => {
		const records = [lead('a', 1, 2)];

		const { state } = processRecords(stateFor('leadCreated', 8), records, EVENTS.leadCreated);

		expect(state.cursor).toBe(at(8));
	});

	it('moves the cursor even when no record shows the event', () => {
		const records = [lead('a', -30, 4)];

		const { state } = processRecords(stateFor('leadCreated'), records, EVENTS.leadCreated);

		expect(state.cursor).toBe(at(4));
	});

	it('emits events oldest first', () => {
		const records = [lead('second', 3), lead('first', 1)];

		const { emitted } = processRecords(stateFor('leadCreated'), records, EVENTS.leadCreated);

		expect(emitted.map((record) => record.id)).toEqual(['first', 'second']);
	});

	it('does not treat a lead saved only at creation as updated', () => {
		const records = [lead('fresh', 1, 1)];

		const { emitted } = processRecords(stateFor('leadUpdated'), records, EVENTS.leadUpdated);

		expect(emitted).toEqual([]);
	});

	it('emits an updated lead again when it changes again', () => {
		const first = processRecords(stateFor('leadUpdated'), [lead('a', -10, 1)], EVENTS.leadUpdated);

		const second = processRecords(first.state, [lead('a', -10, 2)], EVENTS.leadUpdated);

		expect(second.emitted.map((record) => record.updated_at)).toEqual([at(2)]);
	});

	it('does not report the first stage of a new deal as a stage change', () => {
		const deal = { id: 'd', created_at: at(1), updated_at: at(1), stage_entered_at: at(1) };

		const { emitted } = processRecords(
			stateFor('dealStageChanged'),
			[deal],
			EVENTS.dealStageChanged,
		);

		expect(emitted).toEqual([]);
	});

	it('reports a deal that moved to another stage', () => {
		const deal = { id: 'd', created_at: at(-60), updated_at: at(2), stage_entered_at: at(2) };

		const { emitted } = processRecords(
			stateFor('dealStageChanged'),
			[deal],
			EVENTS.dealStageChanged,
		);

		expect(emitted).toEqual([deal]);
	});

	it('does not report an old stage move again when the deal changes for another reason', () => {
		const deal = { id: 'd', created_at: at(-60), updated_at: at(9), stage_entered_at: at(1) };

		const { emitted } = processRecords(
			stateFor('dealStageChanged', 8),
			[deal],
			EVENTS.dealStageChanged,
		);

		expect(emitted).toEqual([]);
	});

	it('reports a won deal by the time it was closed', () => {
		const deal = {
			id: 'd',
			status: 'won',
			created_at: at(-60),
			updated_at: at(3),
			closed_at: at(3),
		};

		const { emitted } = processRecords(stateFor('dealWon'), [deal], EVENTS.dealWon);

		expect(emitted).toEqual([deal]);
	});

	it('does not report a lost deal as won', () => {
		const deal = {
			id: 'd',
			status: 'lost',
			created_at: at(-60),
			updated_at: at(3),
			closed_at: at(3),
		};

		const { emitted } = processRecords(stateFor('dealWon'), [deal], EVENTS.dealWon);

		expect(emitted).toEqual([]);
	});

	it('reports a deal won again after it was reopened', () => {
		const firstWin = {
			id: 'd',
			status: 'won',
			created_at: at(-60),
			updated_at: at(1),
			closed_at: at(1),
		};
		const secondWin = { ...firstWin, updated_at: at(3), closed_at: at(3) };
		const first = processRecords(stateFor('dealWon'), [firstWin], EVENTS.dealWon);

		const second = processRecords(first.state, [secondWin], EVENTS.dealWon);

		expect(second.emitted).toEqual([secondWin]);
	});

	it('reports a task marked as done', () => {
		const task = {
			id: 't',
			status: 'done',
			created_at: at(-5),
			updated_at: at(2),
			completed_at: at(2),
		};

		const { emitted } = processRecords(stateFor('taskCompleted'), [task], EVENTS.taskCompleted);

		expect(emitted).toEqual([task]);
	});

	it('follows created_at for notes', () => {
		const note = { id: 'n', content: 'Call after 6 pm', created_at: at(4) };

		const { state } = processRecords(stateFor('noteCreated'), [note], EVENTS.noteCreated);

		expect(state.cursor).toBe(at(4));
	});

	it('forgets keys that fell out of the next window', () => {
		const state = { ...stateFor('leadCreated'), seen: { 'lead-created:old': at(-30) } };

		const next = processRecords(state, [lead('a', 5)], EVENTS.leadCreated);

		expect(Object.keys(next.state.seen)).toEqual(['lead-created:a']);
	});
});

describe('pruneSeen', () => {
	it('keeps only the newest keys beyond the cap', () => {
		const seen = Object.fromEntries(
			Array.from({ length: MAX_SEEN_KEYS + 5 }, (_, index) => [`k${index}`, at(index / 1000)]),
		);

		const result = pruneSeen(seen, ACTIVATED_AT);

		expect(Object.keys(result)).toHaveLength(MAX_SEEN_KEYS);
		expect(result[`k${MAX_SEEN_KEYS + 4}`]).toBeDefined();
		expect(result.k0).toBeUndefined();
	});
});

describe('reachedWindowStart', () => {
	it('is true once a page of notes has one older than the window', () => {
		const page = [{ created_at: at(5) }, { created_at: at(-3) }];

		const result = reachedWindowStart(page, at(-2));

		expect(result).toBe(true);
	});

	it('is false while every note is inside the window', () => {
		const page = [{ created_at: at(5) }, { created_at: at(1) }];

		const result = reachedWindowStart(page, at(-2));

		expect(result).toBe(false);
	});
});

describe('pickSample', () => {
	it('picks the most recent record that shows the event', () => {
		const records = [lead('fresh', 9, 9), lead('edited', 1, 8), lead('older-edit', 1, 5)];

		const result = pickSample(records, EVENTS.leadUpdated);

		expect(result?.id).toBe('edited');
	});

	it('returns nothing when no record shows the event', () => {
		const records = [{ id: 'd', status: 'open', created_at: at(1), updated_at: at(1) }];

		const result = pickSample(records, EVENTS.dealWon);

		expect(result).toBeUndefined();
	});
});
