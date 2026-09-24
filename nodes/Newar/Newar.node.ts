import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import * as customField from './actions/customField';
import * as deal from './actions/deal';
import * as lead from './actions/lead';
import * as lossReason from './actions/lossReason';
import * as note from './actions/note';
import * as pipeline from './actions/pipeline';
import { router } from './actions/router';
import * as search from './actions/search';
import * as stage from './actions/stage';
import * as tag from './actions/tag';
import * as task from './actions/task';
import * as user from './actions/user';
import { listSearch, loadOptions, resourceMapping } from './methods';

export class Newar implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Newar',
		name: 'newar',
		icon: { light: 'file:../../icons/newar.svg', dark: 'file:../../icons/newar.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Manage leads, deals, tasks, notes and tags in the Newar CRM',
		defaults: {
			name: 'Newar',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'newarApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Custom Field',
						value: 'customField',
					},
					{
						name: 'Deal',
						value: 'deal',
					},
					{
						name: 'Lead',
						value: 'lead',
					},
					{
						name: 'Loss Reason',
						value: 'lossReason',
					},
					{
						name: 'Note',
						value: 'note',
					},
					{
						name: 'Pipeline',
						value: 'pipeline',
					},
					{
						name: 'Search',
						value: 'search',
					},
					{
						name: 'Stage',
						value: 'stage',
					},
					{
						name: 'Tag',
						value: 'tag',
					},
					{
						name: 'Task',
						value: 'task',
					},
					{
						name: 'User',
						value: 'user',
					},
				],
				default: 'lead',
			},
			...customField.description,
			...deal.description,
			...lead.description,
			...lossReason.description,
			...note.description,
			...pipeline.description,
			...search.description,
			...stage.description,
			...tag.description,
			...task.description,
			...user.description,
		],
	};

	methods = {
		listSearch,
		loadOptions,
		resourceMapping,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await router.call(this);
	}
}
