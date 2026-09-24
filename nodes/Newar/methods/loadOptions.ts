import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { isUuid } from '../helpers/fields';
import { newarApiRequest } from '../transport';
import { labelUser, loadPipelines, loadStages, stageLabel } from './shared';

/** Options for dropdowns inside collections (owners, stages, tags, ...). */

async function getList(context: ILoadOptionsFunctions, path: string, qs?: IDataObject) {
	const response = await newarApiRequest.call(context, { method: 'GET', path, qs });
	return (response.data as IDataObject[] | undefined) ?? [];
}

export async function getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const users = await getList(this, '/v1/users');
	return users.map((user) => ({ name: labelUser(user), value: String(user.id) }));
}

export async function getPipelines(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const pipelines = await loadPipelines(this);
	return pipelines.map((pipeline) => ({ name: String(pipeline.name), value: String(pipeline.id) }));
}

export async function getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { stages, pipelineNames, filteredByPipeline } = await loadStages(this);
	return stages.map((stage) => ({
		name: stageLabel(stage, pipelineNames, !filteredByPipeline),
		value: String(stage.id),
	}));
}

/** Lead tags. Deal tags exist in Newar, but the API doesn't set them on deals yet. */
export async function getLeadTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const tags = await getList(this, '/v1/tags', { entity: 'lead' });
	return tags.map((tag) => ({ name: String(tag.name), value: String(tag.id) }));
}

export async function getLossReasons(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const reasons = await getList(this, '/v1/loss-reasons');
	return reasons.map((reason) => ({ name: String(reason.label), value: String(reason.id) }));
}

/** Deals of the lead chosen in the node, for a task's deal. */
export async function getLeadDeals(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	let leadId: unknown;
	try {
		leadId = this.getCurrentNodeParameter('leadId', { extractValue: true });
	} catch {
		leadId = undefined;
	}
	if (!isUuid(leadId)) return [];
	const deals = await getList(this, '/v1/deals', {
		lead_id: leadId.trim(),
		sort_by: 'updated_at',
		sort_direction: 'desc',
		limit: 100,
	});
	return deals.map((deal) => ({
		name: `${String(deal.title)}${deal.status !== 'open' ? ` [${String(deal.status)}]` : ''}`,
		value: String(deal.id),
	}));
}
