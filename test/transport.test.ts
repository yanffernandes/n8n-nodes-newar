import { NodeApiError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { newarApiRequest, normalizeBaseUrl } from '../nodes/Newar/transport';
import { apiError, executeContext, ok } from './support/context';

describe('newarApiRequest', () => {
	it('unwraps the data and the next cursor of the envelope', async () => {
		const { context } = executeContext({ parameters: {}, respond: () => ok([{ id: 1 }], 'next') });

		const response = await newarApiRequest.call(context, { method: 'GET', path: '/v1/leads' });

		expect(response.data).toEqual([{ id: 1 }]);
		expect(response.nextCursor).toBe('next');
	});

	it('calls the base URL of the credential without a double slash', async () => {
		const { context, requests } = executeContext({ parameters: {}, respond: () => ok({}) });

		await newarApiRequest.call(context, { method: 'GET', path: '/v1/me' });

		expect(requests[0].url).toBe('https://api.test/api/v1/me');
	});

	it('reads HTTP errors itself instead of letting the helper throw', async () => {
		const { context, requests } = executeContext({ parameters: {}, respond: () => ok({}) });

		await newarApiRequest.call(context, { method: 'GET', path: '/v1/me' });

		expect(requests[0]).toMatchObject({ ignoreHttpStatusErrors: true, returnFullResponse: true });
	});

	it('drops empty query values', async () => {
		const { context, requests } = executeContext({ parameters: {}, respond: () => ok([]) });

		await newarApiRequest.call(context, {
			method: 'GET',
			path: '/v1/leads',
			qs: { owner_id: '', cursor: undefined, limit: 50 },
		});

		expect(requests[0].qs).toEqual({ limit: 50 });
	});

	it('throws a NodeApiError with the English message for the error code', async () => {
		const { context } = executeContext({
			parameters: {},
			respond: () => apiError(404, 'not_found', 'Lead não encontrado.'),
		});

		const act = newarApiRequest.call(context, { method: 'GET', path: '/v1/leads/x', itemIndex: 2 });

		await expect(act).rejects.toThrow('The lead was not found in Newar');
	});

	it('keeps the status code and the item on the error', async () => {
		const { context } = executeContext({
			parameters: {},
			respond: () => apiError(404, 'not_found', 'Lead não encontrado.'),
		});

		const error = await newarApiRequest
			.call(context, { method: 'GET', path: '/v1/leads/x', itemIndex: 2 })
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('404');
		expect((error as NodeApiError).context.itemIndex).toBe(2);
	});

	it('declares a rate limit as such, without waiting', async () => {
		const { context } = executeContext({
			parameters: {},
			respond: () => ({
				...apiError(429, 'rate_limit_exceeded'),
				headers: { 'retry-after': '120' },
			}),
		});

		const error = (await newarApiRequest
			.call(context, { method: 'GET', path: '/v1/leads' })
			.catch((caught: unknown) => caught)) as NodeApiError;

		expect(error.failure).toMatchObject({ cause: 'rate-limited', retryAfterMs: 120_000 });
	});

	it('explains a legacy forbidden write from a read-only token', async () => {
		const { context } = executeContext({
			parameters: {},
			credentials: { apiToken: 'nw_r_test' },
			respond: () => apiError(403, 'forbidden'),
		});

		const act = newarApiRequest.call(context, { method: 'POST', path: '/v1/leads', body: {} });

		await expect(act).rejects.toThrow('This Newar token is read-only');
	});

	it('wraps a network failure and points it at the item', async () => {
		const { context } = executeContext({
			parameters: {},
			respond: () => new Error('socket hang up'),
		});

		const error = (await newarApiRequest
			.call(context, { method: 'GET', path: '/v1/me', itemIndex: 1 })
			.catch((caught: unknown) => caught)) as NodeApiError;

		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.context.itemIndex).toBe(1);
	});
});

describe('normalizeBaseUrl', () => {
	it('falls back to the production API when empty', () => {
		const baseUrl = '';

		const result = normalizeBaseUrl(baseUrl);

		expect(result).toBe('https://api.newar.com.br/functions/v1/api');
	});

	it('removes trailing slashes', () => {
		const baseUrl = 'https://api.newar.com.br/functions/v1/api//';

		const result = normalizeBaseUrl(baseUrl);

		expect(result).toBe('https://api.newar.com.br/functions/v1/api');
	});
});
