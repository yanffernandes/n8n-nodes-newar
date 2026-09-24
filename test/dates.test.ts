import { describe, expect, it } from 'vitest';

import { toDateOnly, toIsoDateTime } from '../nodes/Newar/helpers/dates';

describe('toIsoDateTime', () => {
	it('reads a naive date-time in the workflow time zone', () => {
		const value = '2026-09-30T14:00:00';

		const result = toIsoDateTime(value, 'America/Sao_Paulo');

		expect(result).toBe('2026-09-30T17:00:00.000Z');
	});

	it('keeps the instant of a value that has an offset', () => {
		const value = '2026-09-30T14:00:00-03:00';

		const result = toIsoDateTime(value, 'Asia/Tokyo');

		expect(result).toBe('2026-09-30T17:00:00.000Z');
	});

	it('turns a bare date into midnight in the workflow time zone', () => {
		const value = '2026-09-30';

		const result = toIsoDateTime(value, 'America/Sao_Paulo');

		expect(result).toBe('2026-09-30T03:00:00.000Z');
	});

	it('accepts a space between date and time', () => {
		const value = '2026-09-30 14:00';

		const result = toIsoDateTime(value, 'UTC');

		expect(result).toBe('2026-09-30T14:00:00.000Z');
	});

	it('reads a Luxon-like DateTime through its ISO string', () => {
		const value = { toISO: () => '2026-09-30T14:00:00.000-03:00' };

		const result = toIsoDateTime(value, 'UTC');

		expect(result).toBe('2026-09-30T17:00:00.000Z');
	});

	it('reads epoch milliseconds', () => {
		const value = Date.UTC(2026, 8, 30, 17);

		const result = toIsoDateTime(value);

		expect(result).toBe('2026-09-30T17:00:00.000Z');
	});

	it('returns undefined for an empty value', () => {
		const value = '   ';

		const result = toIsoDateTime(value);

		expect(result).toBeUndefined();
	});

	it('returns null for text that is not a date', () => {
		const value = 'next friday';

		const result = toIsoDateTime(value);

		expect(result).toBeNull();
	});

	it('returns null for an impossible calendar date', () => {
		const value = '2026-02-30T10:00:00';

		const result = toIsoDateTime(value, 'UTC');

		expect(result).toBeNull();
	});

	it('falls back to UTC for an unknown time zone', () => {
		const value = '2026-09-30T14:00:00';

		const result = toIsoDateTime(value, 'Not/AZone');

		expect(result).toBe('2026-09-30T14:00:00.000Z');
	});

	it('handles the wall clock during a daylight saving change', () => {
		const value = '2026-03-08T12:00:00';

		const result = toIsoDateTime(value, 'America/New_York');

		expect(result).toBe('2026-03-08T16:00:00.000Z');
	});
});

describe('toDateOnly', () => {
	it('keeps the date as written in an ISO string with an offset', () => {
		const value = '2026-09-30T23:30:00-03:00';

		const result = toDateOnly(value, 'UTC');

		expect(result).toBe('2026-09-30');
	});

	it('keeps the date of a naive date-time from the date picker', () => {
		const value = '2026-09-30T00:00:00';

		const result = toDateOnly(value);

		expect(result).toBe('2026-09-30');
	});

	it('reads a JavaScript Date in the workflow time zone', () => {
		const value = new Date('2026-10-01T01:00:00.000Z');

		const result = toDateOnly(value, 'America/Sao_Paulo');

		expect(result).toBe('2026-09-30');
	});

	it('uses toISODate of a Luxon-like DateTime', () => {
		const value = { toISO: () => '2026-09-30T23:00:00.000-03:00', toISODate: () => '2026-09-30' };

		const result = toDateOnly(value, 'UTC');

		expect(result).toBe('2026-09-30');
	});

	it('returns null for text that is not a date', () => {
		const value = '30/09/2026';

		const result = toDateOnly(value);

		expect(result).toBeNull();
	});

	it('returns undefined for null', () => {
		const value = null;

		const result = toDateOnly(value);

		expect(result).toBeUndefined();
	});
});
