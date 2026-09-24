import { describe, expect, it } from 'vitest';

import {
	customIdempotencyKey,
	deriveIdempotencyKey,
	IDEMPOTENCY_KEY_PATTERN,
	type IdempotencySource,
} from '../nodes/Newar/helpers/idempotency';

const SOURCE: IdempotencySource = {
	instanceId: 'instance-1',
	workflowId: 'workflow-1',
	executionId: '4821',
	nodeId: 'node-uuid',
	nodeName: 'Create Lead',
	runIndex: 0,
	itemIndex: 0,
};

const REQUEST = { method: 'POST', path: '/v1/leads', body: '{"name":"Ana Souza"}' };

describe('deriveIdempotencyKey', () => {
	it('gives the same key when n8n retries the same item', () => {
		const first = deriveIdempotencyKey(SOURCE, REQUEST);

		const retried = deriveIdempotencyKey({ ...SOURCE }, { ...REQUEST });

		expect(retried).toBe(first);
	});

	it('produces a key Newar accepts', () => {
		const result = deriveIdempotencyKey(SOURCE, REQUEST);

		expect(result).toMatch(/^n8n-[0-9a-f]{40}$/);
		expect(IDEMPOTENCY_KEY_PATTERN.test(result ?? '')).toBe(true);
	});

	it.each([
		['instanceId', 'instance-2'],
		['workflowId', 'workflow-2'],
		['executionId', '4822'],
		['nodeId', 'other-node'],
		['nodeName', 'Create Lead 2'],
		['runIndex', 1],
		['itemIndex', 1],
	] as const)('changes the key when %s changes', (field, value) => {
		const base = deriveIdempotencyKey(SOURCE, REQUEST);

		const changed = deriveIdempotencyKey({ ...SOURCE, [field]: value }, REQUEST);

		expect(changed).not.toBe(base);
	});

	it('changes the key when the request body changes', () => {
		const base = deriveIdempotencyKey(SOURCE, REQUEST);

		const changed = deriveIdempotencyKey(SOURCE, { ...REQUEST, body: '{"name":"Bia"}' });

		expect(changed).not.toBe(base);
	});

	it('gives no key without an execution ID', () => {
		const source = { ...SOURCE, executionId: undefined };

		const result = deriveIdempotencyKey(source, REQUEST);

		expect(result).toBeUndefined();
	});
});

describe('customIdempotencyKey', () => {
	it('namespaces the key by endpoint', () => {
		const userKey = 'crm-123';

		const result = customIdempotencyKey('/v1/leads', userKey);

		expect(result).toBe('lead:crm-123');
	});

	it('keeps the same external ID distinct across endpoints', () => {
		const userKey = 'crm-123';

		const forDeal = customIdempotencyKey('/v1/deals', userKey);

		expect(forDeal).toBe('deal:crm-123');
	});

	it('trims the value the user set', () => {
		const userKey = '  crm-123 \n';

		const result = customIdempotencyKey('/v1/tasks', userKey);

		expect(result).toBe('task:crm-123');
	});

	it('hashes a value with characters Newar refuses', () => {
		const userKey = 'João Souza 123';

		const result = customIdempotencyKey('/v1/notes', userKey);

		expect(result).toMatch(/^note:sha256-[0-9a-f]{64}$/);
	});

	it('hashes a value longer than Newar accepts', () => {
		const userKey = 'x'.repeat(300);

		const result = customIdempotencyKey('/v1/tags', userKey) ?? '';

		expect(IDEMPOTENCY_KEY_PATTERN.test(result)).toBe(true);
	});

	it('gives no key for a blank value', () => {
		const userKey = '   ';

		const result = customIdempotencyKey('/v1/leads', userKey);

		expect(result).toBeUndefined();
	});
});
