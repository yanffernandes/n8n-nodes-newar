import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { describeNewarError, getHeader, tokenScopeOf, type HeaderBag } from '../helpers/errors';
import { collectItems, type Page } from '../helpers/pagination';

export type NewarContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export const CREDENTIAL_TYPE = 'newarApi';
export const DEFAULT_BASE_URL = 'https://api.newar.com.br/functions/v1/api';

/** Largest page of a list endpoint. */
export const LIST_PAGE_SIZE = 500;
/** Largest page of `/v1/leads/search` and `/v1/deals/search`. */
export const SEARCH_PAGE_SIZE = 100;

const REQUEST_TIMEOUT_MS = 60_000;

export interface NewarRequest {
	method: IHttpRequestMethods;
	/** Path after the base URL, starting with `/v1`. */
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
	headers?: Record<string, string>;
	itemIndex?: number;
}

export interface NewarResponse<T> {
	data: T;
	nextCursor: string | null;
	headers: HeaderBag;
	statusCode: number;
}

interface FullResponse {
	body: unknown;
	headers?: HeaderBag;
	statusCode: number;
}

interface NewarCredentials {
	apiToken?: string;
	baseUrl?: string;
}

export function normalizeBaseUrl(baseUrl: unknown): string {
	const value = typeof baseUrl === 'string' ? baseUrl.trim() : '';
	return (value === '' ? DEFAULT_BASE_URL : value).replace(/\/+$/, '');
}

function compactQuery(qs: IDataObject | undefined): IDataObject | undefined {
	if (!qs) return undefined;
	const compacted: IDataObject = {};
	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		compacted[key] = value;
	}
	return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function toErrorResponse(body: unknown, statusCode: number): JsonObject {
	if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
		return { ...(body as JsonObject), httpCode: String(statusCode) };
	}
	return {
		httpCode: String(statusCode),
		body: typeof body === 'string' ? body.slice(0, 1000) : null,
	};
}

/**
 * Calls the Newar API and unwraps its envelope `{ success, data, additional_data }`.
 *
 * HTTP errors are read here (not thrown by the HTTP helper) so every Newar
 * error code gets its English message, guidance and failure cause.
 */
export async function newarApiRequest<T = unknown>(
	this: NewarContext,
	request: NewarRequest,
): Promise<NewarResponse<T>> {
	const credentials = await this.getCredentials<NewarCredentials>(CREDENTIAL_TYPE);
	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${normalizeBaseUrl(credentials.baseUrl)}${request.path}`,
		qs: compactQuery(request.qs),
		headers: { Accept: 'application/json', ...request.headers },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout: REQUEST_TIMEOUT_MS,
	};
	if (request.body !== undefined) options.body = request.body;

	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_TYPE,
			options,
		)) as FullResponse;
	} catch (error) {
		if (error instanceof NodeApiError && request.itemIndex !== undefined) {
			error.context.itemIndex = request.itemIndex;
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			itemIndex: request.itemIndex,
			message: 'Could not reach Newar',
			description:
				"Check the 'Base URL' of the 'Newar API' credential and the network between n8n and Newar, then try again.",
		});
	}

	const headers = response.headers ?? {};
	if (response.statusCode >= 400) {
		const described = describeNewarError(
			{ statusCode: response.statusCode, body: response.body, headers },
			{ method: request.method, tokenScope: tokenScopeOf(credentials.apiToken) },
		);
		throw new NodeApiError(this.getNode(), toErrorResponse(response.body, response.statusCode), {
			message: described.message,
			description: described.description,
			httpCode: described.httpCode,
			itemIndex: request.itemIndex,
			failure: described.failure,
		});
	}

	if (getHeader(headers, 'idempotent-replayed') === 'true') {
		this.logger.debug('Newar returned the stored response of an earlier create with the same key', {
			path: request.path,
		});
	}

	const envelope = (response.body ?? {}) as {
		data?: T;
		additional_data?: { next_cursor?: string | null };
	};
	return {
		data: envelope.data as T,
		nextCursor: envelope.additional_data?.next_cursor ?? null,
		headers,
		statusCode: response.statusCode,
	};
}

export interface ListRequest {
	path: string;
	qs?: IDataObject;
	itemIndex?: number;
	/** Page size limit of the endpoint. */
	maxPageSize?: number;
	/** Where the items are in `data`: the array itself, or `data.items` for searches. */
	itemsAt?: 'data' | 'data.items';
}

/** Reads a cursor-paginated list, keeping every filter and sort between pages. */
export async function newarApiRequestAllItems(
	this: NewarContext,
	request: ListRequest,
	options: { returnAll: boolean; limit?: number },
): Promise<IDataObject[]> {
	const maxPageSize = request.maxPageSize ?? LIST_PAGE_SIZE;
	return await collectItems<IDataObject>(
		async (cursor, pageSize) => await fetchPage.call(this, request, cursor, pageSize),
		{ returnAll: options.returnAll, limit: options.limit, maxPageSize },
	);
}

/** Reads one page of a list or search endpoint. */
export async function fetchPage(
	this: NewarContext,
	request: ListRequest,
	cursor: string | undefined,
	pageSize: number,
): Promise<Page<IDataObject>> {
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: request.path,
		qs: { ...request.qs, limit: pageSize, cursor },
		itemIndex: request.itemIndex,
	});
	const data = response.data as unknown;
	const items =
		request.itemsAt === 'data.items'
			? ((data as { items?: IDataObject[] } | undefined)?.items ?? [])
			: Array.isArray(data)
				? (data as IDataObject[])
				: [];
	return { items, nextCursor: response.nextCursor };
}
