import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { buildQuery, InvalidParameterError, type QueryField } from '../Newar/helpers/fields';
import { collectWithinBudget } from '../Newar/helpers/pagination';
import { getPipelines, getStages, getUsers, getLeadTags } from '../Newar/methods/loadOptions';
import { fetchPage, LIST_PAGE_SIZE } from '../Newar/transport';
import {
	EVENTS,
	initialState,
	isPollState,
	isTriggerEvent,
	pickSample,
	processRecords,
	reachedWindowStart,
	windowStart,
	type EventDefinition,
	type PollState,
	type TriggerResource,
} from './polling';

/** Requests per poll, at most: protects the token's 6,000 requests per hour. */
const MAX_PAGES_PER_POLL = 10;
const NOTE_PAGE_SIZE = 100;
const SAMPLE_PAGE_SIZE = 25;
/** Budget for n8n versions that don't give one to polling nodes. */
const DEFAULT_POLL_BUDGET_MS = 60_000;

const LEAD_EVENTS = ['leadCreated', 'leadUpdated'];
const DEAL_EVENTS = ['dealCreated', 'dealLost', 'dealStageChanged', 'dealUpdated', 'dealWon'];
const TASK_EVENTS = ['taskCompleted', 'taskCreated'];

const FILTERS: Record<TriggerResource, QueryField[]> = {
	lead: [
		{ param: 'ownerId', api: 'owner_id', kind: 'id', label: 'Owner' },
		{ param: 'pipelineId', api: 'pipeline_id', kind: 'id', label: 'Pipeline' },
		{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
		{ param: 'tagId', api: 'tag_id', kind: 'id', label: 'Tag' },
	],
	deal: [
		{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' },
		{ param: 'ownerId', api: 'owner_id', kind: 'id', label: 'Owner' },
		{ param: 'pipelineId', api: 'pipeline_id', kind: 'id', label: 'Pipeline' },
		{ param: 'stageId', api: 'stage_id', kind: 'id', label: 'Stage' },
	],
	task: [
		{ param: 'assignedToId', api: 'assigned_to_id', kind: 'id', label: 'Assignee' },
		{ param: 'kinds', api: 'kind', kind: 'csv', label: 'Task Types' },
		{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' },
	],
	note: [{ param: 'leadId', api: 'lead_id', kind: 'id', label: 'Lead ID' }],
};

function pollBudgetMs(context: IPollFunctions): number {
	const budget =
		typeof context.getPollBudgetMs === 'function'
			? context.getPollBudgetMs()
			: DEFAULT_POLL_BUDGET_MS;
	return Number.isFinite(budget) && budget > 0 ? Math.floor(budget * 0.8) : DEFAULT_POLL_BUDGET_MS;
}

function writeState(staticData: IDataObject, state: PollState): void {
	for (const key of Object.keys(staticData)) delete staticData[key];
	Object.assign(staticData, state);
}

function readFilters(context: IPollFunctions, definition: EventDefinition): IDataObject {
	const filters = (context.getNodeParameter('filters', {}) as IDataObject) ?? {};
	try {
		return buildQuery(filters, FILTERS[definition.resource]);
	} catch (error) {
		if (error instanceof InvalidParameterError) {
			throw new NodeOperationError(context.getNode(), error.message, {
				description: error.description,
			});
		}
		throw new NodeOperationError(context.getNode(), error as Error);
	}
}

async function fetchSample(
	context: IPollFunctions,
	definition: EventDefinition,
	query: IDataObject,
): Promise<IDataObject | undefined> {
	const qs =
		definition.resource === 'note'
			? query
			: { ...query, sort_by: definition.sampleSortBy, sort_direction: 'desc' };
	const page = await fetchPage.call(
		context,
		{ path: definition.path, qs },
		undefined,
		SAMPLE_PAGE_SIZE,
	);
	return pickSample(page.items, definition);
}

export class NewarTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Newar Trigger',
		name: 'newarTrigger',
		icon: { light: 'file:../../icons/newar.svg', dark: 'file:../../icons/newar.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{ {"dealCreated":"Deal Created","dealLost":"Deal Lost","dealStageChanged":"Deal Stage Changed","dealUpdated":"Deal Updated","dealWon":"Deal Won","leadCreated":"Lead Created","leadUpdated":"Lead Updated","noteCreated":"Note Created","taskCompleted":"Task Completed","taskCreated":"Task Created"}[$parameter["event"]] }}',
		description: 'Starts the workflow when leads, deals, tasks or notes change in Newar',
		defaults: {
			name: 'Newar Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'newarApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Trigger On',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'Deal Created',
						value: 'dealCreated',
						description: 'A deal is created',
					},
					{
						name: 'Deal Lost',
						value: 'dealLost',
						description: 'A deal is marked as lost',
					},
					{
						name: 'Deal Stage Changed',
						value: 'dealStageChanged',
						description: 'A deal moves to another stage',
					},
					{
						name: 'Deal Updated',
						value: 'dealUpdated',
						description: 'A deal changes after it was created',
					},
					{
						name: 'Deal Won',
						value: 'dealWon',
						description: 'A deal is marked as won',
					},
					{
						name: 'Lead Created',
						value: 'leadCreated',
						description: 'A lead is created, in the app, by a form or by the API',
					},
					{
						name: 'Lead Updated',
						value: 'leadUpdated',
						description: 'A lead changes after it was created',
					},
					{
						name: 'Note Created',
						value: 'noteCreated',
						description: 'A note is added to a lead or a deal',
					},
					{
						name: 'Task Completed',
						value: 'taskCompleted',
						description: 'A task is marked as done',
					},
					{
						name: 'Task Created',
						value: 'taskCreated',
						description: 'A task is created',
					},
				],
				default: 'leadCreated',
			},
			{
				displayName:
					'Newar checks for changes on the schedule below and sends each change once. Deleted records are not reported. Each check uses one request of the 6,000 per hour a token has.',
				name: 'pollingNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'Assignee Name or ID',
						name: 'assignedToId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getUsers' },
						default: '',
						displayOptions: { show: { '/event': TASK_EVENTS } },
						description:
							'Only tasks of this user. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Lead ID',
						name: 'leadId',
						type: 'string',
						default: '',
						placeholder: 'e.g. 0f8d3c2a-6b1e-4f7a-9c5d-2e4b8a1f6c3d',
						displayOptions: { show: { '/event': [...DEAL_EVENTS, ...TASK_EVENTS, 'noteCreated'] } },
						description: 'Only records of this lead',
					},
					{
						displayName: 'Owner Name or ID',
						name: 'ownerId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getUsers' },
						default: '',
						displayOptions: { show: { '/event': [...LEAD_EVENTS, ...DEAL_EVENTS] } },
						description:
							'Only records of this owner. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Pipeline Name or ID',
						name: 'pipelineId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getPipelines' },
						default: '',
						displayOptions: { show: { '/event': [...LEAD_EVENTS, ...DEAL_EVENTS] } },
						description:
							'Only records in this pipeline. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Stage Name or ID',
						name: 'stageId',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getStages',
							loadOptionsDependsOn: ['filters.pipelineId'],
						},
						default: '',
						displayOptions: { show: { '/event': [...LEAD_EVENTS, ...DEAL_EVENTS] } },
						description:
							'Only records in this stage. With \'Deal Stage Changed\', only deals that entered it. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Tag Name or ID',
						name: 'tagId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getLeadTags' },
						default: '',
						displayOptions: { show: { '/event': LEAD_EVENTS } },
						description:
							'Only leads with this tag. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Task Types',
						name: 'kinds',
						type: 'multiOptions',
						options: [
							{ name: 'Call', value: 'call' },
							{ name: 'Email', value: 'email' },
							{ name: 'Meeting', value: 'meeting' },
							{ name: 'Other', value: 'other' },
							{ name: 'Visit', value: 'visit' },
							{ name: 'WhatsApp Call', value: 'call_whatsapp' },
							{ name: 'WhatsApp Message', value: 'message_whatsapp' },
						],
						default: [],
						displayOptions: { show: { '/event': TASK_EVENTS } },
						description: 'Only tasks of these types',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getLeadTags,
			getPipelines,
			getStages,
			getUsers,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		if (!isTriggerEvent(event)) {
			throw new NodeOperationError(this.getNode(), `The event '${event}' is not supported`, {
				description: "Pick an event in 'Trigger On'.",
			});
		}
		const definition = EVENTS[event];
		const query = { ...definition.query, ...readFilters(this, definition) };

		if (this.getMode() === 'manual') {
			const sample = await fetchSample(this, definition, query);
			return sample ? [this.helpers.returnJsonArray([sample])] : null;
		}

		const staticData = this.getWorkflowStaticData('node');
		if (!isPollState(staticData, event)) {
			writeState(staticData, initialState(event, Date.now()));
			return null;
		}
		const state = staticData as unknown as PollState;
		const since = windowStart(state);
		const isNote = definition.resource === 'note';
		const qs = isNote
			? query
			: { ...query, updated_since: since, sort_by: 'updated_at', sort_direction: 'asc' };

		const { items, complete } = await collectWithinBudget<IDataObject>(
			async (cursor, pageSize) =>
				await fetchPage.call(this, { path: definition.path, qs }, cursor, pageSize),
			{
				pageSize: isNote ? NOTE_PAGE_SIZE : LIST_PAGE_SIZE,
				maxPages: MAX_PAGES_PER_POLL,
				deadline: Date.now() + pollBudgetMs(this),
				now: () => Date.now(),
				stopWhen: isNote ? (page) => reachedWindowStart(page, since) : undefined,
			},
		);

		const { emitted, state: next } = processRecords(state, items, definition);
		writeState(staticData, next);

		if (!complete) {
			this.logger.warn(
				isNote
					? `Newar Trigger read the ${items.length} newest notes and skipped older ones created since ${since}: more notes were created than one check can read.`
					: `Newar Trigger read ${items.length} changes since ${since} and will read the rest on the next check.`,
			);
		}

		return emitted.length > 0 ? [this.helpers.returnJsonArray(emitted)] : null;
	}
}
