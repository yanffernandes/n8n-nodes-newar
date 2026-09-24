import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INode,
	IPollFunctions,
} from 'n8n-workflow';

export interface FakeResponse {
	statusCode: number;
	body?: unknown;
	headers?: Record<string, string>;
}

export type Responder = (request: IHttpRequestOptions) => FakeResponse | Error;

export const LEAD_ID = '0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d';
export const DEAL_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
export const USER_ID = '5c1d7e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';

/** A read-write test credential; the value is not a real Newar token. */
export const TEST_CREDENTIALS = { apiToken: 'nw_rw_test', baseUrl: 'https://api.test/api/' };

export function ok(data: unknown, nextCursor: string | null = null): FakeResponse {
	return {
		statusCode: 200,
		body: { success: true, data, additional_data: { next_cursor: nextCursor } },
	};
}

export function apiError(statusCode: number, code: string, message = 'Mensagem.'): FakeResponse {
	return { statusCode, body: { success: false, error: { code, message } } };
}

const NODE: INode = {
	id: 'node-1',
	name: 'Newar',
	type: 'n8n-nodes-newar.newar',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function locatorValue(value: unknown): unknown {
	if (typeof value === 'object' && value !== null && '__rl' in value) {
		return (value as IDataObject).value;
	}
	return value;
}

interface CommonOptions {
	respond: Responder;
	credentials?: IDataObject;
}

function requestRecorder(respond: Responder) {
	const requests: IHttpRequestOptions[] = [];
	const httpRequestWithAuthentication = async (_type: string, request: IHttpRequestOptions) => {
		requests.push(request);
		const response = respond(request);
		if (response instanceof Error) throw response;
		return {
			body: response.body,
			headers: response.headers ?? {},
			statusCode: response.statusCode,
		};
	};
	return { requests, httpRequestWithAuthentication };
}

const LOGGER = { debug() {}, info() {}, warn() {}, error() {} };

export function executeContext(
	options: CommonOptions & {
		parameters: IDataObject | IDataObject[];
		items?: number;
		continueOnFail?: boolean;
		executionId?: string;
		runIndex?: number;
	},
) {
	const { requests, httpRequestWithAuthentication } = requestRecorder(options.respond);
	const items = options.items ?? 1;
	const context = {
		getNode: () => NODE,
		getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
		getNodeParameter: (
			name: string,
			itemIndex: number,
			fallback?: unknown,
			parameterOptions?: { extractValue?: boolean },
		) => {
			const parameters = Array.isArray(options.parameters)
				? options.parameters[itemIndex]
				: options.parameters;
			const value = name in parameters ? parameters[name] : fallback;
			if (value === undefined) throw new Error(`Could not get parameter "${name}"`);
			return parameterOptions?.extractValue ? locatorValue(value) : value;
		},
		continueOnFail: () => options.continueOnFail ?? false,
		getTimezone: () => 'America/Sao_Paulo',
		getInstanceId: () => 'instance-1',
		getWorkflow: () => ({ id: 'workflow-1', name: 'Test', active: false }),
		getExecutionId: () => options.executionId ?? '1001',
		getWorkflowDataProxy: () => ({ $runIndex: options.runIndex ?? 0 }),
		getCredentials: async () => options.credentials ?? TEST_CREDENTIALS,
		logger: LOGGER,
		helpers: { httpRequestWithAuthentication },
	};
	return { context: context as unknown as IExecuteFunctions, requests };
}

export function pollContext(
	options: CommonOptions & {
		parameters: IDataObject;
		mode?: 'manual' | 'trigger';
		staticData?: IDataObject;
	},
) {
	const { requests, httpRequestWithAuthentication } = requestRecorder(options.respond);
	const staticData = options.staticData ?? {};
	const context = {
		getNode: () => ({ ...NODE, name: 'Newar Trigger', type: 'n8n-nodes-newar.newarTrigger' }),
		getNodeParameter: (name: string, fallback?: unknown) =>
			name in options.parameters ? options.parameters[name] : fallback,
		getMode: () => options.mode ?? 'trigger',
		getWorkflowStaticData: () => staticData,
		getPollBudgetMs: () => 60_000,
		getCredentials: async () => options.credentials ?? TEST_CREDENTIALS,
		logger: LOGGER,
		helpers: {
			httpRequestWithAuthentication,
			returnJsonArray: (data: IDataObject[]) => data.map((json) => ({ json })),
		},
	};
	return { context: context as unknown as IPollFunctions, requests, staticData };
}

export function locator(value: string) {
	return { __rl: true, mode: 'id', value };
}
