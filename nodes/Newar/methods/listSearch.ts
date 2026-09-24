import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';

import { fetchPage, newarApiRequest } from '../transport';
import { labelUser, loadPipelines, loadStages, stageLabel } from './shared';

/**
 * "From List" modes of the resource locators. Lists that Newar paginates pass
 * `next_cursor` through as n8n's pagination token.
 */

const PAGE_SIZE = 50;
const NEWAR_APP_URL = 'https://app.newar.com.br';
const MIN_SEARCH_TERM = 2;

function matches(filter: string | undefined, ...texts: Array<unknown>): boolean {
	if (!filter) return true;
	const needle = filter.trim().toLowerCase();
	return texts.some((text) => typeof text === 'string' && text.toLowerCase().includes(needle));
}

function describeLead(lead: IDataObject): INodeListSearchItems {
	const detail = (lead.email ?? lead.phone ?? lead.company) as string | null | undefined;
	return {
		name: detail ? `${String(lead.name)} (${detail})` : String(lead.name),
		value: String(lead.id),
		url: `${NEWAR_APP_URL}/leads/${String(lead.id)}`,
	};
}

function describeDeal(deal: IDataObject): INodeListSearchItems {
	const status = deal.status && deal.status !== 'open' ? ` [${String(deal.status)}]` : '';
	return { name: `${String(deal.title)}${status}`, value: String(deal.id) };
}

async function searchOrList(
	context: ILoadOptionsFunctions,
	resource: 'leads' | 'deals',
	filter: string | undefined,
	paginationToken: string | undefined,
): Promise<{ items: IDataObject[]; nextCursor: string | null }> {
	const term = filter?.trim() ?? '';
	if (term.length >= MIN_SEARCH_TERM) {
		const page = await fetchPage.call(
			context,
			{ path: `/v1/${resource}/search`, qs: { term }, itemsAt: 'data.items' },
			paginationToken,
			PAGE_SIZE,
		);
		return {
			items: page.items.map((hit) => (hit.item ?? {}) as IDataObject),
			nextCursor: page.nextCursor,
		};
	}
	const page = await fetchPage.call(
		context,
		{ path: `/v1/${resource}`, qs: { sort_by: 'updated_at', sort_direction: 'desc' } },
		paginationToken,
		PAGE_SIZE,
	);
	return { items: page.items, nextCursor: page.nextCursor };
}

export async function searchLeads(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const { items, nextCursor } = await searchOrList(this, 'leads', filter, paginationToken);
	return { results: items.map(describeLead), paginationToken: nextCursor ?? undefined };
}

export async function searchDeals(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const { items, nextCursor } = await searchOrList(this, 'deals', filter, paginationToken);
	return { results: items.map(describeDeal), paginationToken: nextCursor ?? undefined };
}

export async function searchTasks(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const term = filter?.trim() ?? '';
	if (term.length >= 3) {
		const response = await newarApiRequest.call(this, {
			method: 'GET',
			path: '/v1/search',
			qs: { term, item_types: 'task', limit: 30 },
		});
		const hits = ((response.data as { items?: IDataObject[] } | undefined)?.items ?? []).map(
			(hit) => (hit.item ?? {}) as IDataObject,
		);
		return {
			results: hits.map((task) => ({ name: String(task.title), value: String(task.id) })),
		};
	}
	const page = await fetchPage.call(
		this,
		{ path: '/v1/tasks', qs: { sort_by: 'updated_at', sort_direction: 'desc' } },
		paginationToken,
		PAGE_SIZE,
	);
	return {
		results: page.items
			.filter((task) => matches(term, task.title))
			.map((task) => ({
				name: `${String(task.title)}${task.status !== 'open' ? ` [${String(task.status)}]` : ''}`,
				value: String(task.id),
			})),
		paginationToken: page.nextCursor ?? undefined,
	};
}

export async function searchNotes(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = await fetchPage.call(this, { path: '/v1/notes' }, paginationToken, PAGE_SIZE);
	return {
		results: page.items
			.filter((note) => matches(filter, note.content))
			.map((note) => {
				const content = String(note.content ?? '')
					.replace(/\s+/g, ' ')
					.trim();
				return {
					name: content.length > 80 ? `${content.slice(0, 77)}...` : content || String(note.id),
					value: String(note.id),
				};
			}),
		paginationToken: page.nextCursor ?? undefined,
	};
}

export async function searchPipelines(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const pipelines = await loadPipelines(this);
	return {
		results: pipelines
			.filter((pipeline) => matches(filter, pipeline.name))
			.map((pipeline) => ({ name: String(pipeline.name), value: String(pipeline.id) })),
	};
}

export async function searchStages(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const { stages, pipelineNames, filteredByPipeline } = await loadStages(this);
	return {
		results: stages
			.map((stage) => ({
				name: stageLabel(stage, pipelineNames, !filteredByPipeline),
				value: String(stage.id),
			}))
			.filter((stage) => matches(filter, stage.name)),
	};
}

export async function searchUsers(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await newarApiRequest.call(this, { method: 'GET', path: '/v1/users' });
	const users = (response.data as IDataObject[] | undefined) ?? [];
	return {
		results: users
			.filter((user) => matches(filter, user.name, user.email))
			.map((user) => ({ name: labelUser(user), value: String(user.id) })),
	};
}

export async function searchLossReasons(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await newarApiRequest.call(this, { method: 'GET', path: '/v1/loss-reasons' });
	const reasons = (response.data as IDataObject[] | undefined) ?? [];
	return {
		results: reasons
			.filter((reason) => matches(filter, reason.label))
			.map((reason) => ({ name: String(reason.label), value: String(reason.id) })),
	};
}

export async function searchTags(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await newarApiRequest.call(this, { method: 'GET', path: '/v1/tags' });
	const tags = (response.data as IDataObject[] | undefined) ?? [];
	return {
		results: tags
			.filter((tag) => matches(filter, tag.name))
			.map((tag) => ({
				name: `${String(tag.name)} (${tag.entity === 'deal' ? 'Deal' : 'Lead'})`,
				value: String(tag.id),
			})),
	};
}
