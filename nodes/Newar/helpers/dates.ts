/**
 * Date handling for the Newar API.
 *
 * Newar accepts date-times as RFC 3339 with an offset (`due_at`, `updated_since`)
 * and calendar dates as `YYYY-MM-DD` (`next_step_due`, date custom fields).
 *
 * n8n hands dates over in several shapes: the date picker emits naive
 * `2026-09-30T14:00:00` strings in the workflow time zone, expressions produce
 * ISO strings with an offset or Luxon `DateTime` objects, and code can pass
 * `Date` objects or epoch milliseconds. Everything is normalised here, without
 * Luxon, so the package keeps zero runtime dependencies.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/;
const NAIVE_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

interface DateTimeLike {
	toISO: () => string | null;
	toISODate?: () => string | null;
}

function isDateTimeLike(value: unknown): value is DateTimeLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { toISO?: unknown }).toISO === 'function'
	);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
export function timeZoneOffsetMs(epochMs: number, timeZone: string): number {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
	const parts: Record<string, number> = {};
	for (const part of formatter.formatToParts(new Date(epochMs))) {
		if (part.type !== 'literal') parts[part.type] = Number(part.value);
	}
	const hour = parts.hour === 24 ? 0 : parts.hour;
	const wallClockAsUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		hour,
		parts.minute,
		parts.second,
	);
	const wholeSecondsEpoch = epochMs - (((epochMs % 1000) + 1000) % 1000);
	return wallClockAsUtc - wholeSecondsEpoch;
}

/** The instant at which the wall clock in `timeZone` shows the given time. */
export function wallClockToEpochMs(
	fields: [number, number, number, number, number, number, number],
	timeZone: string,
): number {
	const [year, month, day, hour, minute, second, millisecond] = fields;
	const asUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
	let offset: number;
	try {
		offset = timeZoneOffsetMs(asUtc, timeZone);
	} catch {
		return asUtc;
	}
	const firstGuess = asUtc - offset;
	const correctedOffset = timeZoneOffsetMs(firstGuess, timeZone);
	return correctedOffset === offset ? firstGuess : asUtc - correctedOffset;
}

function calendarDateInZone(epochMs: number, timeZone: string): string {
	let shifted = epochMs;
	try {
		shifted = epochMs + timeZoneOffsetMs(epochMs, timeZone);
	} catch {
		shifted = epochMs;
	}
	return new Date(shifted).toISOString().slice(0, 10);
}

function unwrap(value: unknown): unknown {
	if (isDateTimeLike(value)) return value.toISO() ?? undefined;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
	return value;
}

/**
 * Normalises a date-time to an ISO 8601 string in UTC (`2026-09-30T17:00:00.000Z`).
 *
 * Naive values (no offset) are read in `timeZone`, the workflow time zone.
 * A bare date becomes midnight in that zone. Returns `undefined` for empty
 * input and `null` when the value cannot be read as a date.
 */
export function toIsoDateTime(value: unknown, timeZone = 'UTC'): string | null | undefined {
	const raw = unwrap(value);
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (raw instanceof Date) return raw.toISOString();
	if (typeof raw === 'number') {
		return Number.isFinite(raw) ? new Date(raw).toISOString() : null;
	}
	if (typeof raw !== 'string') return null;

	const text = raw.trim();
	if (text === '') return undefined;

	const dateOnly = DATE_ONLY.exec(text);
	if (dateOnly) {
		const [year, month, day] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
		if (!isValidCalendarDate(year, month, day)) return null;
		return new Date(wallClockToEpochMs([year, month, day, 0, 0, 0, 0], timeZone)).toISOString();
	}

	const naive = NAIVE_DATE_TIME.exec(text);
	if (naive) {
		const [year, month, day] = [Number(naive[1]), Number(naive[2]), Number(naive[3])];
		const [hour, minute, second] = [Number(naive[4]), Number(naive[5]), Number(naive[6] ?? 0)];
		const millisecond = Number((naive[7] ?? '0').padEnd(3, '0').slice(0, 3));
		if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
			return null;
		}
		return new Date(
			wallClockToEpochMs([year, month, day, hour, minute, second, millisecond], timeZone),
		).toISOString();
	}

	if (!HAS_OFFSET.test(text) || !DATE_PREFIX.test(text)) return null;
	const parsed = Date.parse(text);
	return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * Normalises a value to a calendar date (`YYYY-MM-DD`).
 *
 * Strings keep the date as written (`2026-09-30T23:00:00-03:00` stays
 * `2026-09-30`), so no time zone conversion can shift the day. Instants
 * (`Date`, epoch milliseconds) are read in `timeZone`. Returns `undefined`
 * for empty input and `null` when the value is not a date.
 */
export function toDateOnly(value: unknown, timeZone = 'UTC'): string | null | undefined {
	if (isDateTimeLike(value) && typeof value.toISODate === 'function') {
		return value.toISODate() ?? null;
	}
	const raw = unwrap(value);
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (raw instanceof Date) return calendarDateInZone(raw.getTime(), timeZone);
	if (typeof raw === 'number') {
		return Number.isFinite(raw) ? calendarDateInZone(raw, timeZone) : null;
	}
	if (typeof raw !== 'string') return null;

	const text = raw.trim();
	if (text === '') return undefined;
	const prefix = DATE_PREFIX.exec(text);
	if (!prefix) return null;
	const [year, month, day] = prefix[1].split('-').map(Number);
	return isValidCalendarDate(year, month, day) ? prefix[1] : null;
}
