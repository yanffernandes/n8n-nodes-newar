import { describe, expect, it, vi } from 'vitest';

import { collectItems, collectWithinBudget, type Page } from '../nodes/Newar/helpers/pagination';

function pagesOf(pages: Array<Page<number>>) {
	const calls: Array<{ cursor: string | undefined; pageSize: number }> = [];
	let index = 0;
	const fetchPage = vi.fn(async (cursor: string | undefined, pageSize: number) => {
		calls.push({ cursor, pageSize });
		return pages[index++] ?? { items: [], nextCursor: null };
	});
	return { fetchPage, calls };
}

describe('collectItems', () => {
	it('follows next_cursor until it is null when returning all', async () => {
		const { fetchPage } = pagesOf([
			{ items: [1, 2], nextCursor: 'a' },
			{ items: [3], nextCursor: null },
		]);

		const items = await collectItems(fetchPage, { returnAll: true, maxPageSize: 500 });

		expect(items).toEqual([1, 2, 3]);
	});

	it('passes the previous next_cursor as the cursor of the next page', async () => {
		const { fetchPage, calls } = pagesOf([
			{ items: [1], nextCursor: 'first' },
			{ items: [2], nextCursor: null },
		]);

		await collectItems(fetchPage, { returnAll: true, maxPageSize: 500 });

		expect(calls.map((call) => call.cursor)).toEqual([undefined, 'first']);
	});

	it('asks for the largest page when returning all', async () => {
		const { fetchPage, calls } = pagesOf([{ items: [1], nextCursor: null }]);

		await collectItems(fetchPage, { returnAll: true, maxPageSize: 500 });

		expect(calls[0].pageSize).toBe(500);
	});

	it('asks only for what the limit still needs', async () => {
		const { fetchPage, calls } = pagesOf([
			{ items: Array.from({ length: 100 }, (_, i) => i), nextCursor: 'a' },
			{ items: [100, 101], nextCursor: 'b' },
		]);

		await collectItems(fetchPage, { returnAll: false, limit: 102, maxPageSize: 100 });

		expect(calls.map((call) => call.pageSize)).toEqual([100, 2]);
	});

	it('stops at the limit even if more pages exist', async () => {
		const { fetchPage } = pagesOf([
			{ items: [1, 2, 3], nextCursor: 'a' },
			{ items: [4, 5, 6], nextCursor: 'b' },
		]);

		const items = await collectItems(fetchPage, { returnAll: false, limit: 4, maxPageSize: 3 });

		expect(items).toEqual([1, 2, 3, 4]);
	});

	it('stops when a cursor repeats, so a broken API cannot loop forever', async () => {
		const fetchPage = vi.fn(async () => ({ items: [1], nextCursor: 'same' }));

		const items = await collectItems(fetchPage, { returnAll: true, maxPageSize: 500 });

		expect(fetchPage).toHaveBeenCalledTimes(2);
		expect(items).toEqual([1, 1]);
	});
});

describe('collectWithinBudget', () => {
	it('reports a complete read when the list ends', async () => {
		const { fetchPage } = pagesOf([{ items: [1], nextCursor: null }]);

		const result = await collectWithinBudget(fetchPage, {
			pageSize: 500,
			maxPages: 10,
			deadline: Number.POSITIVE_INFINITY,
			now: () => 0,
		});

		expect(result).toEqual({ items: [1], complete: true });
	});

	it('stops at the page cap and reports an incomplete read', async () => {
		const fetchPage = vi.fn(async (cursor: string | undefined) => ({
			items: [1],
			nextCursor: `${cursor ?? ''}x`,
		}));

		const result = await collectWithinBudget(fetchPage, {
			pageSize: 500,
			maxPages: 3,
			deadline: Number.POSITIVE_INFINITY,
			now: () => 0,
		});

		expect(fetchPage).toHaveBeenCalledTimes(3);
		expect(result.complete).toBe(false);
	});

	it('stops asking for pages once the deadline passes', async () => {
		let clock = 0;
		const fetchPage = vi.fn(async (cursor: string | undefined) => {
			clock += 1000;
			return { items: [1], nextCursor: `${cursor ?? ''}x` };
		});

		const result = await collectWithinBudget(fetchPage, {
			pageSize: 500,
			maxPages: 100,
			deadline: 2500,
			now: () => clock,
		});

		expect(fetchPage).toHaveBeenCalledTimes(3);
		expect(result.complete).toBe(false);
	});

	it('stops early when the caller says the page reached its window', async () => {
		const { fetchPage } = pagesOf([
			{ items: [5, 4], nextCursor: 'a' },
			{ items: [3, 2], nextCursor: 'b' },
		]);

		const result = await collectWithinBudget(fetchPage, {
			pageSize: 2,
			maxPages: 10,
			deadline: Number.POSITIVE_INFINITY,
			now: () => 0,
			stopWhen: (page) => page.some((item) => item < 5),
		});

		expect(result).toEqual({ items: [5, 4], complete: true });
	});
});
