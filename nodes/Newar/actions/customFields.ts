import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	ResourceMapperValue,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { coerceCustomFieldValues, type CustomFieldMode } from '../helpers/customFields';

/** Name of the "Custom Fields" resource mapper parameter for a record type and mode. */
export function customFieldsParameterName(entity: 'lead' | 'deal', mode: CustomFieldMode): string {
	return mode === 'create' ? `${entity}CustomFields` : `${entity}CustomFieldsUpdate`;
}

/** The "Custom Fields" resource mapper, fed by `/v1/lead-fields` or `/v1/deal-fields`. */
export function customFieldsProperty(
	entity: 'lead' | 'deal',
	mode: CustomFieldMode,
): INodeProperties {
	return {
		displayName: 'Custom Fields',
		name: customFieldsParameterName(entity, mode),
		type: 'resourceMapper',
		noDataExpression: true,
		default: { mappingMode: 'defineBelow', value: null },
		description: `Values for the ${entity}'s custom fields, as defined in Newar under Settings > Fields`,
		hint:
			mode === 'update'
				? 'Only the fields you add are changed. A field you add and leave empty is cleared.'
				: 'Empty fields are skipped. Select fields take one of their options, date fields only use the date.',
		typeOptions: {
			resourceMapper: {
				resourceMapperMethod: entity === 'lead' ? 'getLeadCustomFields' : 'getDealCustomFields',
				mode: 'add',
				fieldWords: { singular: 'custom field', plural: 'custom fields' },
				addAllFields: mode === 'create',
				multiKeyMatch: false,
				supportAutoMap: false,
				noFieldsError: `This Newar workspace has no custom ${entity} fields`,
				hideNoDataError: true,
			},
		},
	};
}

/** Reads the resource mapper and returns `custom_fields` ready for the API, or nothing. */
export function readCustomFields(
	ctx: IExecuteFunctions,
	entity: 'lead' | 'deal',
	mode: CustomFieldMode,
	itemIndex: number,
	timeZone: string,
): IDataObject | undefined {
	const mapper = ctx.getNodeParameter(customFieldsParameterName(entity, mode), itemIndex, {
		mappingMode: 'defineBelow',
		value: null,
	}) as Partial<ResourceMapperValue> | null;
	if (!mapper?.value) return undefined;

	const { values, problems } = coerceCustomFieldValues(mapper.value, mapper.schema, mode, timeZone);
	if (problems.length > 0) {
		const [first] = problems;
		throw new NodeOperationError(ctx.getNode(), `Custom field '${first.key}' ${first.message}`, {
			itemIndex,
			description: problems.map((problem) => `'${problem.key}' ${problem.message}`).join('; '),
		});
	}
	return Object.keys(values).length > 0 ? values : undefined;
}
