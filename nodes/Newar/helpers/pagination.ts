/**
 * Cursor pagination for the Newar API.
 *
 * Every list answers `additional_data.next_cursor`. Passing it back as
 * `cursor`, with the same filters and the same sort, reads the next page, and
 * `null` means the list ended. Newar refuses (422) a cursor replayed with a
 * different sort, so callers must keep the query identical between pages:
 * `fetchPage` only receives the cursor and the page size.
 */

export interface Page<T> {
	items: T[];
	nextCursor: string | null;
}

export type FetchPage<T> = (cursor: string | undefined, pageSize: number) => Promise<Page<T>>;

export interface CollectOptions {
	/** Read every page until `next_cursor` is null. */
	returnAll: boolean;
	/** Maximum number of items when `returnAll` is false. */
	limit?: number;
	/** Largest page the endpoint accepts (500 for lists, 100 for searches). */
	maxPageSize: number;
}

/** Reads pages until the limit is reached or the list ends. */
export async function collectItems<T>(
	fetchPage: FetchPage<T>,
	options: CollectOptions,
): Promise<T[]> {
	const { returnAll, maxPageSize } = options;
	const limit = returnAll ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(options.limit ?? 0));
	const items: T[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;

	while (items.length < limit) {
		const pageSize = Math.min(maxPageSize, limit - items.length);
		const page = await fetchPage(cursor, pageSize);
		items.push(...page.items.slice(0, limit - items.length));
		if (!page.nextCursor || page.items.length === 0 || seenCursors.has(page.nextCursor)) break;
		seenCursors.add(page.nextCursor);
		cursor = page.nextCursor;
	}

	return items;
}

export interface BoundedCollectOptions<T> {
	pageSize: number;
	/** Upper bound on requests, to protect the hourly request budget. */
	maxPages: number;
	/** Epoch milliseconds after which no new page is requested. */
	deadline: number;
	now: () => number;
	/** Stops early once the last page read satisfies this (e.g. older than a cursor). */
	stopWhen?: (page: T[]) => boolean;
}

export interface BoundedCollectResult<T> {
	items: T[];
	/** False when a page limit or the deadline stopped the read before the list ended. */
	complete: boolean;
}

/** Reads pages within a time and request budget, for polling. */
export async function collectWithinBudget<T>(
	fetchPage: FetchPage<T>,
	options: BoundedCollectOptions<T>,
): Promise<BoundedCollectResult<T>> {
	const items: T[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;

	for (let pages = 0; pages < options.maxPages; pages++) {
		if (pages > 0 && options.now() >= options.deadline) return { items, complete: false };
		const page = await fetchPage(cursor, options.pageSize);
		items.push(...page.items);
		if (options.stopWhen?.(page.items)) return { items, complete: true };
		if (!page.nextCursor || page.items.length === 0 || seenCursors.has(page.nextCursor)) {
			return { items, complete: true };
		}
		seenCursors.add(page.nextCursor);
		cursor = page.nextCursor;
	}

	return { items, complete: false };
}
