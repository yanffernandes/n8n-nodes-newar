import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { isUuid } from '../helpers/fields';
import {
	NATIVE_LEAD_FILTER_FIELDS,
	customLeadFilterFields,
	operatorOptions,
	type LeadFilterField,
} from '../helpers/filterExpression';
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

async function getLeadFields(context: ILoadOptionsFunctions): Promise<IDataObject[]> {
	const response = await newarApiRequest.call(context, { method: 'GET', path: '/v1/lead-fields' });
	const fields: unknown = response.data;
	if (!Array.isArray(fields) || !fields.every(isRecord)) {
		throw new NodeOperationError(
			context.getNode(),
			'Newar returned an unexpected lead field list',
			{
				description: 'Expected data to be an array of custom field records.',
			},
		);
	}
	return fields as IDataObject[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Native filters come from crm_filter_leads_v1; custom filters use cf:<key>. */
export async function getLeadFilterFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const customFields = customLeadFilterFields(await getLeadFields(this));
	return [...NATIVE_LEAD_FILTER_FIELDS, ...customFields]
		.map((field) => ({
			name: field.label,
			value: field.id,
			...(field.description ? { description: field.description } : {}),
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

/** Instagram can be stored in any lead custom field. */
export async function getLeadInstagramFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const fields = await getLeadFields(this);
	return [
		{ name: 'No Custom Field', value: '' },
		...fields
			.filter((field) => typeof field.key === 'string' && field.key.trim() !== '')
			.map((field) => ({
				name: String(field.label ?? field.key),
				value: String(field.key),
			})),
	];
}

/** Only offers operators allowed by the current field's type and source. */
export async function getLeadFilterOperators(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const fieldId = this.getCurrentNodeParameter('&field');
	const id = typeof fieldId === 'string' ? fieldId : '';
	let field: LeadFilterField | undefined = NATIVE_LEAD_FILTER_FIELDS.find((item) => item.id === id);
	if (id.startsWith('cf:')) {
		const key = id.slice(3);
		const customFields = customLeadFilterFields(await getLeadFields(this));
		field = customFields.find((item) => item.id === `cf:${key}`);
	}
	return operatorOptions(field);
}
