import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

import { toResourceMapperFields, type NewarField } from '../helpers/customFields';
import { newarApiRequest } from '../transport';

/** Custom field schemas for the "Custom Fields" resource mappers. */

async function getCustomFields(
	context: ILoadOptionsFunctions,
	entity: 'lead' | 'deal',
): Promise<ResourceMapperFields> {
	const response = await newarApiRequest.call(context, {
		method: 'GET',
		path: `/v1/${entity}-fields`,
	});
	const fields = (response.data as NewarField[] | undefined) ?? [];
	const operation = context.getNodeParameter('operation', 'create') as string;
	return {
		fields: toResourceMapperFields(fields, operation === 'update' ? 'update' : 'create'),
		emptyFieldsNotice: `This Newar workspace has no custom ${entity} fields yet. Create them in Newar under Settings > Fields.`,
	};
}

export async function getLeadCustomFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	return await getCustomFields(this, 'lead');
}

export async function getDealCustomFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	return await getCustomFields(this, 'deal');
}
