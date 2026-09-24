import { createHash } from 'crypto';

/**
 * `Idempotency-Key` for create requests.
 *
 * Newar stores the response of a create for 24 hours per token and key: the
 * same key with the same request replays it (header `Idempotent-Replayed:
 * true`) instead of creating a second record, and the same key with a
 * different request fails with 422 `idempotency_key_reused`. Keys are 1 to 255
 * visible ASCII characters.
 *
 * The default key is derived from where the request comes from (n8n instance,
 * workflow, execution, node, run and item) and from the endpoint, never from
 * the body. When n8n retries a failed node ("Retry On Fail"), every one of
 * those is the same, so the retry replays instead of duplicating. A body that
 * changed between tries (an expression such as the current time) keeps the
 * key: Newar then refuses the retry with `idempotency_key_reused` instead of
 * creating a second record. A second run of the node in the same execution (a
 * loop, or an AI agent calling the tool again) has a new run index, so it
 * creates normally.
 */

export const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;

export interface IdempotencySource {
	instanceId?: string;
	workflowId?: string;
	executionId?: string;
	nodeId?: string;
	nodeName: string;
	runIndex: number;
	itemIndex: number;
}

export interface IdempotentRequest {
	method: string;
	path: string;
}

function sha256(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The default key: `n8n-` followed by 40 hex characters. Returns `undefined`
 * when the execution has no ID (nothing stable to derive from).
 */
export function deriveIdempotencyKey(
	source: IdempotencySource,
	request: IdempotentRequest,
): string | undefined {
	if (!source.executionId) return undefined;
	const material = [
		'newar-idempotency-v1',
		source.instanceId ?? '',
		source.workflowId ?? '',
		source.executionId,
		source.nodeId ?? '',
		source.nodeName,
		String(source.runIndex),
		String(source.itemIndex),
		request.method.toUpperCase(),
		request.path,
	].join('\n');
	return `n8n-${sha256(material).slice(0, 40)}`;
}

/**
 * A key set by the user, such as the record's ID in the source system.
 *
 * It is namespaced by endpoint (`lead:crm-123`), because Newar treats one key
 * sent to two endpoints as reuse: the same external ID can then protect both a
 * Create Lead and a Create Deal. Values Newar would refuse (spaces, accents,
 * more than 255 characters) are hashed into a valid key instead.
 */
export function customIdempotencyKey(path: string, userKey: string): string | undefined {
	const key = userKey.trim();
	if (key === '') return undefined;
	const namespace = path
		.replace(/^\/v1\//, '')
		.replace(/s$/, '')
		.replace(/[^a-z0-9-]/gi, '-');
	const readable = `${namespace}:${key}`;
	if (IDEMPOTENCY_KEY_PATTERN.test(readable)) return readable;
	return `${namespace}:sha256-${sha256(key)}`;
}
