import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { InvalidParameterError } from '../helpers/fields';
import { createUserResolver } from '../helpers/owner';
import { listUsers, type ExecutionContext, type OperationHandler } from './common';
import * as customField from './customField';
import * as deal from './deal';
import * as lead from './lead';
import * as lossReason from './lossReason';
import * as note from './note';
import * as pipeline from './pipeline';
import * as search from './search';
import * as stage from './stage';
import * as tag from './tag';
import * as task from './task';
import * as user from './user';

const HANDLERS: Record<string, Record<string, OperationHandler>> = {
	customField: customField.handlers,
	deal: deal.handlers,
	lead: lead.handlers,
	lossReason: lossReason.handlers,
	note: note.handlers,
	pipeline: pipeline.handlers,
	search: search.handlers,
	stage: stage.handlers,
	tag: tag.handlers,
	task: task.handlers,
	user: user.handlers,
};

function optional<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}

/** How many times this node already ran in the execution (loops, agent tool calls). */
function readRunIndex(ctx: IExecuteFunctions): number {
	const runIndex = optional(() => {
		const proxy = ctx.getWorkflowDataProxy(0);
		return (proxy.$runIndex ?? proxy.$thisRunIndex) as unknown;
	});
	return typeof runIndex === 'number' && Number.isInteger(runIndex) ? runIndex : 0;
}

export function createExecutionContext(ctx: IExecuteFunctions): ExecutionContext {
	const node = ctx.getNode();
	return {
		timeZone: optional(() => ctx.getTimezone()) ?? 'UTC',
		idempotency: {
			instanceId: optional(() => ctx.getInstanceId()),
			workflowId: optional(() => ctx.getWorkflow().id),
			executionId: optional(() => ctx.getExecutionId()),
			nodeId: node.id,
			nodeName: node.name,
			runIndex: readRunIndex(ctx),
		},
		resolveUser: createUserResolver(async (itemIndex) => await listUsers.call(ctx, itemIndex)),
	};
}

/** Every error leaves the node as an n8n error that points at the item. */
export function toNodeError(
	ctx: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		if (error.context.itemIndex === undefined) error.context.itemIndex = itemIndex;
		return error;
	}
	if (error instanceof InvalidParameterError) {
		return new NodeOperationError(ctx.getNode(), error.message, {
			itemIndex,
			description: error.description,
		});
	}
	return new NodeOperationError(ctx.getNode(), error as Error, { itemIndex });
}

function errorJson(error: NodeApiError | NodeOperationError): IDataObject {
	const json: IDataObject = { error: error.message };
	if (error.description) json.description = error.description;
	if (error instanceof NodeApiError && error.httpCode) json.httpCode = error.httpCode;
	return json;
}

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;
	const handler = HANDLERS[resource]?.[operation];
	if (!handler) {
		throw new NodeOperationError(
			this.getNode(),
			`The operation '${operation}' is not available for '${resource}'`,
		);
	}

	const context = createExecutionContext(this);
	const returnData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const result = await handler.call(this, itemIndex, context);
			for (const json of Array.isArray(result) ? result : [result]) {
				returnData.push({ json, pairedItem: { item: itemIndex } });
			}
		} catch (error) {
			const nodeError = toNodeError(this, error, itemIndex);
			if (this.continueOnFail()) {
				returnData.push({ json: errorJson(nodeError), pairedItem: { item: itemIndex } });
				continue;
			}
			throw nodeError;
		}
	}

	return [returnData];
}
