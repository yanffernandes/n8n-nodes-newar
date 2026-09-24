import type { IDataObject } from 'n8n-workflow';

/**
 * Event detection for the Newar Trigger.
 *
 * Newar has no webhooks yet, so the trigger polls the lists: leads, deals and
 * tasks by `updated_since` (sorted by `updated_at`, ascending), notes by
 * `created_at` (newest first, the only order the notes list has).
 *
 * Each poll reads from `cursor - OVERLAP_MS`: `updated_at` is the start time
 * of the database transaction, so a record committed late can carry a time
 * just before the last one seen. The overlap re-reads that margin, and the
 * `seen` keys drop what was already emitted. Nothing older than the
 * activation time (`floor`) is ever emitted.
 */

export const OVERLAP_MS = 2 * 60 * 1000;
/**
 * Keys remembered inside the overlap window. One poll reads up to 10 pages of
 * 500 records; the cap covers two full polls, so a burst (a spreadsheet import
 * creating thousands of leads in a minute) is not emitted twice. Keys older
 * than the window are dropped first, so the cap only matters during a burst.
 */
export const MAX_SEEN_KEYS = 10_000;
export const STATE_VERSION = 1;

export type TriggerEvent =
	| 'dealCreated'
	| 'dealLost'
	| 'dealStageChanged'
	| 'dealUpdated'
	| 'dealWon'
	| 'leadCreated'
	| 'leadUpdated'
	| 'noteCreated'
	| 'taskCompleted'
	| 'taskCreated';

export type TriggerResource = 'lead' | 'deal' | 'task' | 'note';

export interface EventMatch {
	/** When the event happened, as sent by Newar (ISO 8601). */
	timestamp: string;
	/** Identifies one occurrence of the event, for deduplication. */
	key: string;
}

export interface EventDefinition {
	resource: TriggerResource;
	path: string;
	/** Filters every poll sends, so Newar only returns candidates. */
	query: IDataObject;
	/** Field the list is read by: the cursor follows it. */
	orderField: 'updated_at' | 'created_at';
	/** Sort that brings the newest occurrences first, for the manual test sample. */
	sampleSortBy: 'updated_at' | 'created_at';
	/** Whether and when the record shows the event. */
	match: (record: IDataObject) => EventMatch | null;
}

function ms(value: unknown): number {
	return typeof value === 'string' ? Date.parse(value) : Number.NaN;
}

function created(prefix: string) {
	return (record: IDataObject): EventMatch | null =>
		typeof record.created_at === 'string'
			? { timestamp: record.created_at, key: `${prefix}:${String(record.id)}` }
			: null;
}

/** Changed after creation: a record saved once at creation is not "updated". */
function updated(prefix: string) {
	return (record: IDataObject): EventMatch | null => {
		const updatedAt = ms(record.updated_at);
		if (!(updatedAt > ms(record.created_at))) return null;
		return {
			timestamp: record.updated_at as string,
			key: `${prefix}:${String(record.id)}@${String(record.updated_at)}`,
		};
	};
}

function closed(status: 'won' | 'lost', prefix: string) {
	return (record: IDataObject): EventMatch | null => {
		if (record.status !== status || typeof record.closed_at !== 'string') return null;
		return {
			timestamp: record.closed_at,
			key: `${prefix}:${String(record.id)}@${record.closed_at}`,
		};
	};
}

export const EVENTS: Record<TriggerEvent, EventDefinition> = {
	leadCreated: {
		resource: 'lead',
		path: '/v1/leads',
		query: {},
		orderField: 'updated_at',
		sampleSortBy: 'created_at',
		match: created('lead-created'),
	},
	leadUpdated: {
		resource: 'lead',
		path: '/v1/leads',
		query: {},
		orderField: 'updated_at',
		sampleSortBy: 'updated_at',
		match: updated('lead-updated'),
	},
	dealCreated: {
		resource: 'deal',
		path: '/v1/deals',
		query: {},
		orderField: 'updated_at',
		sampleSortBy: 'created_at',
		match: created('deal-created'),
	},
	dealUpdated: {
		resource: 'deal',
		path: '/v1/deals',
		query: {},
		orderField: 'updated_at',
		sampleSortBy: 'updated_at',
		match: updated('deal-updated'),
	},
	dealStageChanged: {
		resource: 'deal',
		path: '/v1/deals',
		query: {},
		orderField: 'updated_at',
		sampleSortBy: 'updated_at',
		// A new deal enters its first stage at creation (same instant): that is not a change.
		match: (record) => {
			if (!(ms(record.stage_entered_at) > ms(record.created_at))) return null;
			return {
				timestamp: record.stage_entered_at as string,
				key: `deal-stage:${String(record.id)}@${String(record.stage_entered_at)}`,
			};
		},
	},
	dealWon: {
		resource: 'deal',
		path: '/v1/deals',
		query: { status: 'won' },
		orderField: 'updated_at',
		sampleSortBy: 'updated_at',
		match: closed('won', 'deal-won'),
	},
	dealLost: {
		resource: 'deal',
		path: '/v1/deals',
		query: { status: 'lost' },
		orderField: 'updated_at',
		sampleSortBy: 'updated_at',
		match: closed('lost', 'deal-lost'),
	},
	taskCreated: {
		resource: 'task',
		path: '/v1/tasks',
		query: {},
		orderField: 'updated_at',
		sampleSortBy: 'created_at',
		match: created('task-created'),
	},
	taskCompleted: {
		resource: 'task',
		path: '/v1/tasks',
		query: { status: 'done' },
		orderField: 'updated_at',
		sampleSortBy: 'updated_at',
		match: (record) => {
			if (record.status !== 'done' || typeof record.completed_at !== 'string') return null;
			return {
				timestamp: record.completed_at,
				key: `task-done:${String(record.id)}@${record.completed_at}`,
			};
		},
	},
	noteCreated: {
		resource: 'note',
		path: '/v1/notes',
		query: {},
		orderField: 'created_at',
		sampleSortBy: 'created_at',
		match: created('note-created'),
	},
};

export function isTriggerEvent(value: unknown): value is TriggerEvent {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, value);
}

export interface PollState {
	version: number;
	event: TriggerEvent;
	/** Latest value of the order field processed, ISO 8601. */
	cursor: string;
	/** Activation time: nothing before it is emitted. */
	floor: string;
	/** Event keys already emitted, with the event time. */
	seen: Record<string, string>;
}

export function isPollState(value: IDataObject, event: TriggerEvent): boolean {
	return (
		value.version === STATE_VERSION &&
		value.event === event &&
		typeof value.cursor === 'string' &&
		!Number.isNaN(Date.parse(value.cursor)) &&
		typeof value.floor === 'string' &&
		!Number.isNaN(Date.parse(value.floor)) &&
		typeof value.seen === 'object' &&
		value.seen !== null &&
		!Array.isArray(value.seen)
	);
}

export function initialState(event: TriggerEvent, nowMs: number): PollState {
	const now = new Date(nowMs).toISOString();
	return { version: STATE_VERSION, event, cursor: now, floor: now, seen: {} };
}

/** The `updated_since` of the next request. */
export function windowStart(state: PollState): string {
	return new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString();
}

export interface PollResult {
	emitted: IDataObject[];
	state: PollState;
}

/** Picks the new events in a batch of records and moves the cursor forward. */
export function processRecords(
	state: PollState,
	records: IDataObject[],
	definition: EventDefinition,
): PollResult {
	const lowerBound = Math.max(Date.parse(state.cursor) - OVERLAP_MS, Date.parse(state.floor));
	const seen: Record<string, string> = { ...state.seen };
	const events: Array<{ at: number; record: IDataObject }> = [];
	let cursorMs = Date.parse(state.cursor);

	for (const record of records) {
		const orderMs = ms(record[definition.orderField]);
		if (!Number.isNaN(orderMs) && orderMs > cursorMs) cursorMs = orderMs;

		const match = definition.match(record);
		if (!match) continue;
		const at = ms(match.timestamp);
		if (Number.isNaN(at) || at < lowerBound || seen[match.key] !== undefined) continue;
		seen[match.key] = match.timestamp;
		events.push({ at, record });
	}

	const cursor = new Date(cursorMs).toISOString();
	return {
		emitted: events.sort((a, b) => a.at - b.at).map((event) => event.record),
		state: { ...state, cursor, seen: pruneSeen(seen, cursorMs - OVERLAP_MS) },
	};
}

/** Forgets keys older than the next window, and the oldest ones beyond the cap. */
export function pruneSeen(
	seen: Record<string, string>,
	keepFromMs: number,
): Record<string, string> {
	const kept = Object.entries(seen).filter(([, timestamp]) => ms(timestamp) >= keepFromMs);
	if (kept.length > MAX_SEEN_KEYS) {
		kept.sort((a, b) => ms(b[1]) - ms(a[1]));
		kept.length = MAX_SEEN_KEYS;
	}
	return Object.fromEntries(kept);
}

/** Whether a page of notes (newest first) already reached records older than the window. */
export function reachedWindowStart(page: IDataObject[], windowStartIso: string): boolean {
	const start = Date.parse(windowStartIso);
	return page.some((record) => ms(record.created_at) < start);
}

/** The most recent record that shows the event, for the manual "Fetch Test Event". */
export function pickSample(
	records: IDataObject[],
	definition: EventDefinition,
): IDataObject | undefined {
	let best: { at: number; record: IDataObject } | undefined;
	for (const record of records) {
		const match = definition.match(record);
		if (!match) continue;
		const at = ms(match.timestamp);
		if (Number.isNaN(at)) continue;
		if (!best || at > best.at) best = { at, record };
	}
	return best?.record;
}
