import type { IDataObject, ILoadOptionsFunctions } from 'n8n-workflow';

import { isUuid } from '../helpers/fields';
import { newarApiRequest } from '../transport';

/** Parameters where a pipeline can be chosen, checked in order. */
const PIPELINE_PARAMETERS = ['pipelineId', 'additionalFields', 'updateFields', 'filters'];

function readPipelineId(value: unknown): string | undefined {
	if (isUuid(value)) return value.trim();
	if (typeof value === 'object' && value !== null) {
		const record = value as IDataObject;
		if (record.__rl === true && isUuid(record.value)) return (record.value as string).trim();
		if (isUuid(record.pipelineId)) return (record.pipelineId as string).trim();
	}
	return undefined;
}

/** The pipeline chosen elsewhere in the node, if any, to narrow stage lists. */
export function selectedPipelineId(context: ILoadOptionsFunctions): string | undefined {
	for (const name of PIPELINE_PARAMETERS) {
		let value: unknown;
		try {
			value = context.getCurrentNodeParameter(name);
		} catch {
			value = undefined;
		}
		const pipelineId = readPipelineId(value);
		if (pipelineId) return pipelineId;
	}
	return undefined;
}

export async function loadPipelines(context: ILoadOptionsFunctions): Promise<IDataObject[]> {
	const response = await newarApiRequest.call(context, { method: 'GET', path: '/v1/pipelines' });
	return (response.data as IDataObject[] | undefined) ?? [];
}

export interface StageList {
	stages: IDataObject[];
	pipelineNames: Map<string, string>;
	filteredByPipeline: boolean;
}

/** Stages of the chosen pipeline, or of every pipeline, in pipeline order. */
export async function loadStages(context: ILoadOptionsFunctions): Promise<StageList> {
	const pipelineId = selectedPipelineId(context);
	const pipelines = await loadPipelines(context);
	const pipelineNames = new Map(
		pipelines.map((pipeline) => [String(pipeline.id), String(pipeline.name)]),
	);
	const stages = pipelines
		.filter((pipeline) => !pipelineId || pipeline.id === pipelineId)
		.flatMap((pipeline) => (pipeline.stages as IDataObject[] | undefined) ?? []);
	return { stages, pipelineNames, filteredByPipeline: pipelineId !== undefined };
}

export function stageLabel(
	stage: IDataObject,
	pipelineNames: Map<string, string>,
	withPipeline: boolean,
): string {
	const type = stage.type === 'won' || stage.type === 'lost' ? ` (${String(stage.type)})` : '';
	const name = `${String(stage.name)}${type}`;
	const pipeline = pipelineNames.get(String(stage.pipeline_id));
	return withPipeline && pipeline ? `${pipeline} > ${name}` : name;
}

export function labelUser(user: IDataObject): string {
	const name = typeof user.name === 'string' && user.name.trim() !== '' ? user.name.trim() : '';
	const email = typeof user.email === 'string' ? user.email : '';
	if (name && email) return `${name} (${email})`;
	return name || email || String(user.id);
}
