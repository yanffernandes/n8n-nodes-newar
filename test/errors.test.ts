import { describe, expect, it } from 'vitest';

import {
	describeNewarError,
	getHeader,
	labelForField,
	parseApiErrorBody,
	tokenScopeOf,
} from '../nodes/Newar/helpers/errors';

const NOW = Date.UTC(2026, 8, 24, 19, 37, 0);

function failure(statusCode: number, code: string, message = 'Mensagem em português.', extra = {}) {
	return { statusCode, body: { success: false, error: { code, message, ...extra } } };
}

describe('describeNewarError', () => {
	it('explains an invalid token and marks the credential as invalid', () => {
		const response = failure(401, 'unauthorized', 'Token inválido ou revogado.');

		const result = describeNewarError(response);

		expect(result.message).toBe('Newar rejected the API token');
		expect(result.failure).toEqual({ cause: 'credential-invalid' });
	});

	it('keeps the original Newar message in the description', () => {
		const response = failure(401, 'unauthorized', 'Token inválido ou revogado.');

		const result = describeNewarError(response);

		expect(result.description).toContain('Newar said: "Token inválido ou revogado."');
	});

	it('explains a write with a read-only token', () => {
		const response = failure(403, 'read_only_token');

		const result = describeNewarError(response, { method: 'POST' });

		expect(result.message).toBe('This Newar token is read-only');
		expect(result.description).toContain('nw_rw_');
	});

	it('treats a legacy forbidden write from an nw_r_ token as read-only', () => {
		const response = failure(403, 'forbidden');

		const result = describeNewarError(response, { method: 'PATCH', tokenScope: 'read' });

		expect(result.code).toBe('read_only_token');
	});

	it('keeps forbidden for a read with a read-only token', () => {
		const response = failure(403, 'forbidden');

		const result = describeNewarError(response, { method: 'GET', tokenScope: 'read' });

		expect(result.message).toBe('Your Newar user is not allowed to do this');
	});

	it('names the missing record in English', () => {
		const response = failure(404, 'not_found', 'Negócio não encontrado.');

		const result = describeNewarError(response);

		expect(result.message).toBe('The deal was not found in Newar');
	});

	it('falls back to a generic record when the entity is unknown', () => {
		const response = failure(404, 'not_found', 'Rota não encontrada: GET /x.');

		const result = describeNewarError(response);

		expect(result.message).toBe('The record was not found in Newar');
	});

	it('lists the rejected fields with their n8n labels', () => {
		const response = failure(422, 'validation_error', 'Os dados enviados não são válidos.', {
			details: [
				{ field: 'email', message: 'E-mail inválido.' },
				{ field: 'custom_fields.alunos', message: '"Alunos" espera um número.' },
			],
		});

		const result = describeNewarError(response);

		expect(result.message).toBe("Newar rejected the value of Email, Custom field 'alunos'");
	});

	it('puts each field problem in the description', () => {
		const response = failure(422, 'validation_error', 'Inválido.', {
			details: [{ field: 'stage_id', message: 'Etapa não encontrada.' }],
		});

		const result = describeNewarError(response);

		expect(result.description).toContain('Stage: Etapa não encontrada.');
	});

	it('explains a reused idempotency key', () => {
		const response = failure(422, 'idempotency_key_reused');

		const result = describeNewarError(response);

		expect(result.message).toBe('This idempotency key was already used with different data');
	});

	it('gives the reset time of the rate limit and declares it rate-limited', () => {
		const response = {
			...failure(429, 'rate_limit_exceeded'),
			headers: { 'retry-after': '1380', 'x-ratelimit-reset': String(NOW / 1000 + 1380) },
		};

		const result = describeNewarError(response, { now: NOW });

		expect(result.failure).toEqual({
			cause: 'rate-limited',
			retryAfterMs: 1_380_000,
			resetsAtEpochMs: NOW + 1_380_000,
		});
		expect(result.description).toContain('in about 23 minutes');
	});

	it('derives the reset time from Retry-After when the reset header is missing', () => {
		const response = { ...failure(429, 'rate_limit_exceeded'), headers: { 'Retry-After': '60' } };

		const result = describeNewarError(response, { now: NOW });

		expect(result.failure).toMatchObject({ resetsAtEpochMs: NOW + 60_000 });
	});

	it('declares a temporary outage with the wait Newar asked for', () => {
		const response = {
			...failure(503, 'temporarily_unavailable'),
			headers: { 'retry-after': '30' },
		};

		const result = describeNewarError(response);

		expect(result.failure).toEqual({ cause: 'temporarily-unavailable', retryAfterMs: 30_000 });
	});

	it('suggests Retry On Fail for a temporary outage', () => {
		const response = failure(503, 'temporarily_unavailable');

		const result = describeNewarError(response);

		expect(result.description).toContain("'Retry On Fail'");
	});

	it('recognises a create still running under the same idempotency key', () => {
		const response = failure(
			409,
			'conflict',
			'Outra requisição com esta chave de idempotência está em andamento.',
		);

		const result = describeNewarError(response);

		expect(result.message).toBe('Another request with the same idempotency key is still running');
	});

	it('points to Lead > Update for a conflict on a primary deal', () => {
		const response = failure(409, 'conflict', 'Este é o negócio principal do lead.');

		const result = describeNewarError(response);

		expect(result.description).toContain('Lead > Update');
	});

	it.each([
		['plan_limit_reached', 409, 'The Newar plan limit was reached'],
		['tag_in_use', 409, 'The tag is still in use'],
		['task_deal_invalid', 422, "The deal doesn't belong to the task's lead"],
		['bad_request', 400, 'Newar could not read the request'],
		['internal_error', 500, 'Newar had an internal problem'],
	])('maps %s to an English message', (code, status, message) => {
		const response = failure(status, code);

		const result = describeNewarError(response);

		expect(result.message).toBe(message);
	});

	it('describes a response that is not a Newar error by its status', () => {
		const response = { statusCode: 502, body: '<html>Bad gateway</html>' };

		const result = describeNewarError(response);

		expect(result.message).toBe('Newar answered with HTTP 502');
	});

	it.each([
		'unauthorized',
		'read_only_token',
		'forbidden',
		'not_found',
		'plan_limit_reached',
		'tag_in_use',
		'task_deal_invalid',
		'idempotency_key_reused',
		'rate_limit_exceeded',
		'temporarily_unavailable',
		'validation_error',
		'conflict',
		'bad_request',
		'internal_error',
	])('keeps the %s message clear of network error codes n8n would rewrite', (code) => {
		const networkCodes = [
			'ECONNREFUSED',
			'ECONNRESET',
			'ENOTFOUND',
			'ETIMEDOUT',
			'EACCES',
			'EPERM',
			'EEXIST',
			'ENOENT',
		];

		const { message } = describeNewarError(failure(400, code));

		expect(networkCodes.some((networkCode) => message.toUpperCase().includes(networkCode))).toBe(
			false,
		);
	});
});

describe('parseApiErrorBody', () => {
	it('reads a JSON string body', () => {
		const body = JSON.stringify({ success: false, error: { code: 'not_found', message: 'x' } });

		const result = parseApiErrorBody(body);

		expect(result.code).toBe('not_found');
	});

	it('returns nothing for a body that is not JSON', () => {
		const body = 'upstream connect error';

		const result = parseApiErrorBody(body);

		expect(result).toEqual({});
	});
});

describe('labelForField', () => {
	it('labels a custom field by its key', () => {
		const field = 'custom_fields.segmento';

		const result = labelForField(field);

		expect(result).toBe("Custom field 'segmento'");
	});

	it('keeps an unknown field as sent', () => {
		const field = 'something_new';

		const result = labelForField(field);

		expect(result).toBe('something_new');
	});
});

describe('getHeader', () => {
	it('finds a header regardless of case', () => {
		const headers = { 'X-RateLimit-Reset': '1790000000' };

		const result = getHeader(headers, 'x-ratelimit-reset');

		expect(result).toBe('1790000000');
	});
});

describe('tokenScopeOf', () => {
	it.each([
		['nw_r_abc', 'read'],
		['nw_rw_abc', 'read-write'],
		['something', 'unknown'],
		[undefined, 'unknown'],
	])('reads the scope of %s', (token, scope) => {
		const result = tokenScopeOf(token);

		expect(result).toBe(scope);
	});
});
