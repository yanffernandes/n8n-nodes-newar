import type { Failure } from 'n8n-workflow';

/**
 * Turns a failed Newar API response into an English message for n8n.
 *
 * Newar answers every failure with `{ success: false, error: { code, message,
 * details? } }`, where `code` is stable and `message` is Portuguese. n8n's
 * verification asks for English, so the message shown to the user is chosen
 * by `code`, and Newar's own text stays in the description for support.
 */

export interface ApiErrorDetail {
	field: string;
	message: string;
}

export interface ApiErrorBody {
	code?: string;
	message?: string;
	details?: ApiErrorDetail[];
}

export type HeaderBag = Record<string, unknown>;

export interface FailedResponse {
	statusCode: number;
	body: unknown;
	headers?: HeaderBag;
}

export interface ErrorContext {
	/** HTTP method of the request, to tell reads from writes. */
	method?: string;
	/** Scope of the token in use, read from its prefix. Never the token itself. */
	tokenScope?: TokenScope;
	/** Current time in epoch milliseconds. Injected for tests. */
	now?: number;
}

export type TokenScope = 'read' | 'read-write' | 'unknown';

export interface DescribedError {
	message: string;
	description: string;
	httpCode: string;
	code?: string;
	failure?: Failure;
}

const FIELD_LABELS: Record<string, string> = {
	assigned_to_id: 'Assignee',
	body: 'Request Body',
	close_reason: 'Close Reason',
	company: 'Company',
	content: 'Content',
	cursor: 'Pagination Cursor',
	deal_id: 'Deal',
	description: 'Description',
	due_at: 'Due Date',
	due_since: 'Due Since',
	due_until: 'Due Before',
	email: 'Email',
	entity: 'Record Type',
	exact_match: 'Exact Match',
	'Idempotency-Key': 'Idempotency Key',
	id: 'ID',
	ids: 'IDs',
	item_types: 'Record Types',
	kind: 'Type',
	lead_id: 'Lead',
	limit: 'Limit',
	loss_reason_id: 'Loss Reason',
	name: 'Name',
	next_step: 'Next Step',
	next_step_due: 'Next Step Due Date',
	observations: 'Observations',
	owner_id: 'Owner',
	phone: 'Phone',
	pipeline_id: 'Pipeline',
	priority: 'Priority',
	sort_by: 'Sort By',
	sort_direction: 'Sort Direction',
	source: 'Source',
	stage_id: 'Stage',
	status: 'Status',
	tag_id: 'Tag',
	tag_ids: 'Tags',
	term: 'Search Term',
	title: 'Title',
	updated_since: 'Updated Since',
	updated_until: 'Updated Before',
	value: 'Value',
	value_estimate: 'Value Estimate',
};

const ENTITY_NAMES: Record<string, string> = {
	etapa: 'stage',
	funil: 'pipeline',
	lead: 'lead',
	'motivo de perda': 'loss reason',
	negócio: 'deal',
	nota: 'note',
	registro: 'record',
	tag: 'tag',
	tarefa: 'task',
	usuário: 'user',
};

/** The n8n parameter label for an API field path (`custom_fields.alunos` → `Custom field 'alunos'`). */
export function labelForField(field: string): string {
	if (field.startsWith('custom_fields.')) {
		return `Custom field '${field.slice('custom_fields.'.length)}'`;
	}
	const [head, ...rest] = field.split('.');
	const label = FIELD_LABELS[head] ?? head;
	return rest.length > 0 ? `${label} (${rest.join('.')})` : label;
}

export function getHeader(headers: HeaderBag | undefined, name: string): string | undefined {
	if (!headers) return undefined;
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== wanted) continue;
		if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
		return value === undefined || value === null ? undefined : String(value);
	}
	return undefined;
}

/** Reads `{ error: { code, message, details } }`, tolerating bodies that are not Newar's. */
export function parseApiErrorBody(body: unknown): ApiErrorBody {
	let parsed = body;
	if (typeof parsed === 'string') {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			return {};
		}
	}
	if (typeof parsed !== 'object' || parsed === null) return {};
	const error = (parsed as { error?: unknown }).error;
	if (typeof error !== 'object' || error === null) return {};
	const { code, message, details } = error as Record<string, unknown>;
	return {
		code: typeof code === 'string' ? code : undefined,
		message: typeof message === 'string' ? message : undefined,
		details: Array.isArray(details)
			? details
					.filter((detail): detail is ApiErrorDetail => {
						return (
							typeof detail === 'object' &&
							detail !== null &&
							typeof (detail as ApiErrorDetail).field === 'string'
						);
					})
					.map((detail) => ({ field: detail.field, message: String(detail.message ?? '') }))
			: undefined,
	};
}

function secondsToMs(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : undefined;
}

function epochSecondsToMs(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined;
}

function describeWait(ms: number): string {
	const minutes = Math.round(ms / 60000);
	if (ms < 60000) {
		const seconds = Math.max(1, Math.round(ms / 1000));
		return `${seconds} second${seconds === 1 ? '' : 's'}`;
	}
	return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function withNewarSaid(guidance: string, apiMessage: string | undefined): string {
	return apiMessage ? `${guidance} Newar said: "${apiMessage}"` : guidance;
}

function notFoundEntity(apiMessage: string | undefined): string {
	const match = /^(.+?) não encontrad[oa]/i.exec(apiMessage ?? '');
	if (!match) return 'record';
	return ENTITY_NAMES[match[1].trim().toLowerCase()] ?? 'record';
}

function isWrite(method: string | undefined): boolean {
	return method !== undefined && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/** Picks the English message, guidance and failure cause for a failed response. */
export function describeNewarError(
	response: FailedResponse,
	context: ErrorContext = {},
): DescribedError {
	const { statusCode, headers } = response;
	const apiError = parseApiErrorBody(response.body);
	const apiMessage = apiError.message;
	const httpCode = String(statusCode);
	const now = context.now ?? Date.now();
	const code =
		apiError.code === 'forbidden' && context.tokenScope === 'read' && isWrite(context.method)
			? 'read_only_token'
			: apiError.code;

	switch (code) {
		case 'unauthorized':
			return {
				code,
				httpCode,
				message: 'Newar rejected the API token',
				description: withNewarSaid(
					"The token is missing, invalid or revoked, or its user left the workspace. Create a new token in Newar under Settings > API and update the 'Newar API' credential.",
					apiMessage,
				),
				failure: { cause: 'credential-invalid' },
			};
		case 'read_only_token':
			return {
				code,
				httpCode,
				message: 'This Newar token is read-only',
				description: withNewarSaid(
					"Creating, updating and deleting need a read-write token (it starts with nw_rw_). Create one in Newar under Settings > API and use it in the 'Newar API' credential.",
					apiMessage,
				),
				failure: { cause: 'configuration-invalid' },
			};
		case 'forbidden':
			return {
				code,
				httpCode,
				message: 'Your Newar user is not allowed to do this',
				description: withNewarSaid(
					"The token acts as the user who created it, with that user's role. Leads and lead notes need the Leads permission, deals and deal notes need Pipeline, and tasks need Tasks. Renaming or deleting tags needs a workspace owner or admin.",
					apiMessage,
				),
				failure: { cause: 'configuration-invalid' },
			};
		case 'not_found': {
			const entity = notFoundEntity(apiMessage);
			return {
				code,
				httpCode,
				message: `The ${entity} was not found in Newar`,
				description: withNewarSaid(
					'Check the ID used in this node. Records from another workspace, and deleted records, cannot be read or changed.',
					apiMessage,
				),
			};
		}
		case 'plan_limit_reached':
			return {
				code,
				httpCode,
				message: 'The Newar plan limit was reached',
				description: withNewarSaid(
					"The workspace reached its plan's limit for this kind of record. Upgrade the plan or free up space in Newar, then run the node again.",
					apiMessage,
				),
			};
		case 'tag_in_use':
			return {
				code,
				httpCode,
				message: 'The tag is still in use',
				description: withNewarSaid(
					"Only a tag with no records can be deleted, and deleted records still count. Remove the tag from its leads or deals first (see the tag's 'usage_count').",
					apiMessage,
				),
			};
		case 'task_deal_invalid':
			return {
				code,
				httpCode,
				message: "The deal doesn't belong to the task's lead",
				description: withNewarSaid(
					"A task's deal must be a deal of the same lead that is not deleted. Pick one of the lead's deals, or leave 'Deal' empty to attach the task to the lead only.",
					apiMessage,
				),
			};
		case 'idempotency_key_reused':
			return {
				code,
				httpCode,
				message: 'This idempotency key was already used with different data',
				description: withNewarSaid(
					"Newar keeps each key for 24 hours and refuses a different request with the same key. If the node was retried, the record was already created by the earlier try: an expression (such as the current time) changed the data between tries, so Newar refused to create it twice. If you set 'Idempotency Key', make it unique for each record, for example the record's ID in the source system.",
					apiMessage,
				),
			};
		case 'rate_limit_exceeded': {
			const retryAfterMs = secondsToMs(getHeader(headers, 'retry-after'));
			const resetsAtEpochMs =
				epochSecondsToMs(getHeader(headers, 'x-ratelimit-reset')) ??
				(retryAfterMs !== undefined ? now + retryAfterMs : undefined);
			const when =
				resetsAtEpochMs !== undefined
					? `The limit resets at ${new Date(resetsAtEpochMs).toISOString()} (in about ${describeWait(Math.max(0, resetsAtEpochMs - now))}).`
					: 'The limit resets at the start of the next hour.';
			return {
				code,
				httpCode,
				message: 'The Newar API rate limit was reached',
				description: withNewarSaid(
					`Each token can make 6,000 requests per hour. ${when} Run the workflow less often, lower 'Limit' or batch sizes, or give heavy workflows their own token.`,
					apiMessage,
				),
				failure: { cause: 'rate-limited', retryAfterMs, resetsAtEpochMs },
			};
		}
		case 'temporarily_unavailable': {
			const retryAfterMs = secondsToMs(getHeader(headers, 'retry-after'));
			const wait =
				retryAfterMs !== undefined ? `Newar asked to wait ${describeWait(retryAfterMs)}. ` : '';
			return {
				code,
				httpCode,
				message: 'Newar is temporarily unavailable',
				description: withNewarSaid(
					`${wait}Turn on 'Retry On Fail' in the node settings, with a wait at least that long. If a list timed out, use a smaller 'Limit'.`,
					apiMessage,
				),
				failure: { cause: 'temporarily-unavailable', retryAfterMs },
			};
		}
		case 'validation_error': {
			const fields = (apiError.details ?? []).map((detail) => labelForField(detail.field));
			const uniqueFields = fields.filter((field, index) => fields.indexOf(field) === index);
			const detailLines = (apiError.details ?? [])
				.map((detail) => `${labelForField(detail.field)}: ${detail.message}`)
				.join('; ');
			return {
				code,
				httpCode,
				message:
					uniqueFields.length > 0
						? `Newar rejected the value of ${uniqueFields.join(', ')}`
						: 'Newar rejected the data sent',
				description: withNewarSaid(
					detailLines
						? `Fix these fields and run the node again. ${detailLines}.`
						: 'Check the values in this node and run it again.',
					apiMessage,
				),
			};
		}
		case 'conflict': {
			if (/idempot/i.test(apiMessage ?? '')) {
				return {
					code,
					httpCode,
					message: 'Another request with the same idempotency key is still running',
					description: withNewarSaid(
						"Wait a few seconds and run the node again: Newar then returns the first request's result instead of creating the record twice.",
						apiMessage,
					),
					failure: { cause: 'temporarily-unavailable' },
				};
			}
			return {
				code,
				httpCode,
				message: "Newar refused the change because of the record's current state",
				description: withNewarSaid(
					"Common causes: the deal is the lead's primary deal (change its title, value, owner and next step with Lead > Update), the deal is closed (set 'Status' to Open to move it), the primary deal was deleted on its own (delete the lead instead), or a tag with this name already exists.",
					apiMessage,
				),
			};
		}
		case 'bad_request':
			return {
				code,
				httpCode,
				message: 'Newar could not read the request',
				description: withNewarSaid(
					'Check the values and expressions in this node. If the problem persists, report it at https://github.com/yanffernandes/n8n-nodes-newar/issues.',
					apiMessage,
				),
			};
		case 'internal_error':
			return {
				code,
				httpCode,
				message: 'Newar had an internal problem',
				description: withNewarSaid(
					'Try again in a few moments. If it keeps happening, contact Newar support with the time of this execution.',
					apiMessage,
				),
			};
		default:
			return describeByStatus(statusCode, apiError, response.body);
	}
}

function describeByStatus(
	statusCode: number,
	apiError: ApiErrorBody,
	body: unknown,
): DescribedError {
	const httpCode = String(statusCode);
	const snippet =
		apiError.message ??
		(typeof body === 'string' && body.trim() !== '' ? body.trim().slice(0, 300) : undefined);
	const guidance =
		statusCode >= 500
			? 'Newar or the network in between could not answer. Try again in a few moments.'
			: 'Check the values in this node and the Newar API documentation at https://app.newar.com.br/api.';
	return {
		code: apiError.code,
		httpCode,
		message: `Newar answered with HTTP ${statusCode}${apiError.code ? ` (${apiError.code})` : ''}`,
		description: withNewarSaid(guidance, snippet),
	};
}

/** The scope a token grants, read from its prefix. */
export function tokenScopeOf(token: unknown): TokenScope {
	if (typeof token !== 'string') return 'unknown';
	const trimmed = token.trim();
	if (trimmed.startsWith('nw_rw_')) return 'read-write';
	if (trimmed.startsWith('nw_r_')) return 'read';
	return 'unknown';
}
