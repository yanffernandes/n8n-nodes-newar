import type { IDataObject } from 'n8n-workflow';

/**
 * The "Output" option of reads that return large records (n8n UX guidelines
 * for AI tool nodes): Simplified keeps at most 10 useful fields, Raw keeps
 * everything, and Selected Fields keeps the chosen ones plus the ID.
 */

export type OutputMode = 'simplified' | 'raw' | 'fields';

export type OutputEntity = 'lead' | 'deal' | 'task';

export const RECORD_FIELDS: Record<OutputEntity, string[]> = {
	lead: [
		'id',
		'name',
		'email',
		'phone',
		'emails',
		'phones',
		'company',
		'owner_id',
		'pipeline_id',
		'stage_id',
		'source',
		'score',
		'value_estimate',
		'next_step',
		'next_step_due',
		'observations',
		'custom_fields',
		'tag_ids',
		'utm',
		'created_at',
		'updated_at',
	],
	deal: [
		'id',
		'lead_id',
		'title',
		'status',
		'pipeline_id',
		'stage_id',
		'owner_id',
		'value',
		'score',
		'next_step',
		'next_step_due',
		'observations',
		'source',
		'is_primary',
		'loss_reason_id',
		'close_reason',
		'opened_at',
		'closed_at',
		'stage_entered_at',
		'custom_fields',
		'created_at',
		'updated_at',
	],
	task: [
		'id',
		'lead_id',
		'deal_id',
		'kind',
		'title',
		'description',
		'status',
		'priority',
		'due_at',
		'completed_at',
		'assigned_to_id',
		'created_by_id',
		'created_at',
		'updated_at',
	],
};

export const SIMPLIFIED_FIELDS: Record<OutputEntity, string[]> = {
	lead: [
		'id',
		'name',
		'email',
		'phone',
		'company',
		'stage_id',
		'owner_id',
		'value_estimate',
		'next_step',
		'updated_at',
	],
	deal: [
		'id',
		'title',
		'lead_id',
		'status',
		'stage_id',
		'pipeline_id',
		'owner_id',
		'value',
		'next_step',
		'updated_at',
	],
	task: [
		'id',
		'title',
		'kind',
		'status',
		'priority',
		'due_at',
		'lead_id',
		'deal_id',
		'assigned_to_id',
		'completed_at',
	],
};

function pick(record: IDataObject, fields: string[]): IDataObject {
	const picked: IDataObject = {};
	for (const field of fields) {
		if (field in record) picked[field] = record[field];
	}
	return picked;
}

/** Shapes a record according to the Output option. The ID is always kept. */
export function applyOutput(
	record: IDataObject,
	entity: OutputEntity,
	mode: OutputMode,
	selectedFields: string[] = [],
): IDataObject {
	if (mode === 'raw') return record;
	if (mode === 'fields') {
		const fields = ['id', ...selectedFields.filter((field) => field !== 'id')];
		return pick(record, fields);
	}
	return pick(record, SIMPLIFIED_FIELDS[entity]);
}

/** Flattens a search hit `{ result_score, item }` into the item plus its score. */
export function flattenSearchHit(
	hit: IDataObject,
	shape: (item: IDataObject) => IDataObject = (item) => item,
): IDataObject {
	const item = (hit.item ?? {}) as IDataObject;
	return { ...shape(item), result_score: hit.result_score as number };
}
