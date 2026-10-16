import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { applyOutput, flattenSearchHit, type OutputMode } from '../../helpers/output';
import {
	buildLeadFilterExpression,
	hasCustomLeadFilterField,
	LeadFilterExpressionError,
	leadFilterCatalog,
	VALUELESS_FILTER_OPERATORS,
	type LeadFilterField,
} from '../../helpers/filterExpression';
import {
	fetchPage,
	newarApiRequest,
	newarApiRequestAllItems,
	LIST_PAGE_SIZE,
	SEARCH_PAGE_SIZE,
} from '../../transport';
import {
	type ExecutionContext,
	limitProperty,
	outputProperties,
	readPaging,
	returnAllProperty,
	updateDisplayOptions,
} from '../common';
import { readSearchTerm, searchTermProperty } from '../search/term';

const searchByProperty: INodeProperties = {
	displayName: 'Search By',
	name: 'searchBy',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Text', value: 'text', description: 'Search names, companies, emails and phones' },
		{ name: 'Contact', value: 'contact', description: 'Match phone, email or Instagram contacts' },
		{
			name: 'Conditions',
			value: 'conditions',
			description: 'Filter lead fields with AND and OR groups',
		},
	],
	default: 'text',
};

const contactProperties: INodeProperties[] = [
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		placeholder: 'e.g. +55 (11) 99999-0000, 11999990000',
		description:
			'Matches in any phone format, with or without the 9th digit, country code or punctuation. Separate up to 10 values with commas.',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		default: '',
		placeholder: 'e.g. ana@example.com, bia@example.com',
		description: 'Matches emails without case sensitivity. Separate up to 10 values with commas.',
	},
	{
		displayName: 'Instagram',
		name: 'instagram',
		type: 'string',
		default: '',
		placeholder: 'e.g. @ana_souza, instagram.com/bia',
		description:
			'Matches the Instagram conversations of the lead and, with Instagram Field, that custom field in its common written forms, such as @ana or instagram.com/ana. Comparisons on the custom field are case sensitive, as in the Newar app. Leads without a value in that field are skipped. Separate up to 10 values with commas.',
	},
	{
		displayName: 'Instagram Field Name or ID',
		name: 'instagramField',
		type: 'options',
		default: '',
		options: [{ name: 'No Custom Field', value: '' }],
		placeholder: 'Select the custom field that stores an Instagram username',
		typeOptions: { loadOptionsMethod: 'getLeadInstagramFields' },
		description:
			'Also matches the username stored in this custom field, in its common written forms such as @ana or instagram.com/ana. Comparisons are case sensitive. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Match',
		name: 'contactMatch',
		type: 'options',
		default: 'any',
		options: [
			{
				name: 'Any Value',
				value: 'any',
				description: 'Return every lead that matches at least one value',
			},
			{
				name: 'All Filled Fields',
				value: 'all',
				description: 'Return leads that match every contact field with a value',
			},
		],
		description: 'Choose whether one or every filled contact field must match',
	},
];

const conditionField: INodeProperties = {
	displayName: 'Field Name or ID',
	name: 'field',
	type: 'options',
	default: '',
	options: [],
	required: true,
	typeOptions: { loadOptionsMethod: 'getLeadFilterFields' },
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

const conditionOperator: INodeProperties = {
	displayName: 'Operator Name or ID',
	name: 'operator',
	type: 'options',
	default: 'eq',
	options: [],
	required: true,
	typeOptions: {
		loadOptionsMethod: 'getLeadFilterOperators',
		loadOptionsDependsOn: ['&field'],
	},
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

const conditionValue: INodeProperties = {
	displayName: 'Value',
	name: 'value',
	type: 'string',
	default: '',
	description:
		'Enter a value for the selected operator. Separate lists and ranges with commas. Use YYYY-MM-DD for date fields, RFC3339 with a timezone offset or YYYY-MM-DD for date and time fields, an amount and unit such as 3 days for relative time, or a period such as this_month for calendar periods. Text comparisons are case-sensitive, as in the Newar app. For phone or email matching in any format, use Search By: Contact.',
	displayOptions: { hide: { operator: VALUELESS_FILTER_OPERATORS } },
};

const filterGroupsProperty: INodeProperties = {
	displayName: 'Filter Groups',
	name: 'filterGroups',
	type: 'fixedCollection',
	default: {},
	typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Filter Group' },
	description:
		'Conditions in a group are combined with AND. Groups are combined with OR. For example, (X and Y) or Z uses two groups. Missing custom-field values do not match positive operators, but they match negative operators.',
	options: [
		{
			displayName: 'Group',
			name: 'group',
			values: [
				{
					displayName: 'Conditions',
					name: 'conditions',
					type: 'fixedCollection',
					default: {},
					typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Condition' },
					options: [
						{
							displayName: 'Condition',
							name: 'condition',
							values: [conditionField, conditionOperator, conditionValue],
						},
					],
				},
			],
		},
	],
};

const textSearchProperties = updateDisplayOptions({ show: { searchBy: ['text'] } }, [
	searchTermProperty(
		'Text to look for in names, companies, emails and phones. Separate up to 10 values with commas, such as a name, an email and a phone, to find the leads that match any of them',
		2,
		'e.g. ana souza, ana@example.com, 11999990000',
	),
	{
		displayName: 'Exact Match',
		name: 'exactMatch',
		type: 'boolean',
		default: false,
		description: 'Whether to only return leads where a field is exactly the search term',
	},
]);

const outputAndPagingProperties = updateDisplayOptions(
	{ show: { searchBy: ['text', 'conditions'] } },
	[returnAllProperty(), limitProperty(1000)],
);

const properties: INodeProperties[] = [
	searchByProperty,
	...textSearchProperties,
	...updateDisplayOptions({ show: { searchBy: ['contact'] } }, contactProperties),
	...updateDisplayOptions({ show: { searchBy: ['conditions'] } }, [filterGroupsProperty]),
	...outputAndPagingProperties,
	...outputProperties('lead'),
];

export const description = updateDisplayOptions(
	{ show: { resource: ['lead'], operation: ['search'] } },
	properties,
);

function readCommaSeparatedValues(
	ctx: IExecuteFunctions,
	itemIndex: number,
	parameter: string,
): string[] {
	const raw = ctx.getNodeParameter(parameter, itemIndex, '') as unknown;
	if (raw !== undefined && raw !== null && typeof raw !== 'string') {
		const label = parameter[0].toUpperCase() + parameter.slice(1);
		throw new NodeOperationError(ctx.getNode(), `${label} must be text`, {
			itemIndex,
			description: 'Enter one or more values separated by commas.',
		});
	}
	const value = typeof raw === 'string' ? raw : '';
	const values = value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (values.length > 10) {
		throw new NodeOperationError(ctx.getNode(), `'${parameter}' accepts up to 10 values`, {
			itemIndex,
			description: 'Separate the values with commas.',
		});
	}
	return values;
}

async function executeTextSearch(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject[]> {
	const term = readSearchTerm(this, itemIndex, 2);
	const exactMatch = this.getNodeParameter('exactMatch', itemIndex, false) as boolean;
	const hits = await newarApiRequestAllItems.call(
		this,
		{
			path: '/v1/leads/search',
			qs: { term, ...(exactMatch ? { exact_match: 'true' } : {}) },
			itemIndex,
			maxPageSize: SEARCH_PAGE_SIZE,
			itemsAt: 'data.items',
		},
		readPaging(this, itemIndex),
	);
	if (!hits.every(isLeadTextSearchHit)) {
		throw new NodeOperationError(
			this.getNode(),
			'Newar returned an unexpected Text search response',
			{
				itemIndex,
				description: 'Each result must include a lead with an ID and a score between 0 and 1.',
			},
		);
	}
	const mode = this.getNodeParameter('output', itemIndex, 'simplified') as OutputMode;
	const fields =
		mode === 'fields' ? (this.getNodeParameter('fields', itemIndex, []) as string[]) : [];
	return hits.map((hit) =>
		flattenSearchHit(hit, (lead) => applyOutput(lead, 'lead', mode, fields)),
	);
}

const INSTAGRAM_HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;

/** Normalizes an Instagram value the same way the API does: no @, URL, query or trailing slash, in lowercase. */
export function normalizeInstagramHandle(value: string): string | null {
	const text = value.trim().toLowerCase();
	const profileUrl = text.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
	const handle = (profileUrl?.[1] ?? text.replace(/^@/, '')).replace(/[/?#].*$/, '');
	return INSTAGRAM_HANDLE_PATTERN.test(handle) ? handle : null;
}

const INSTAGRAM_STORED_PREFIXES = [
	'',
	'@',
	'instagram.com/',
	'www.instagram.com/',
	'https://instagram.com/',
	'https://www.instagram.com/',
	'http://instagram.com/',
	'http://www.instagram.com/',
];

/** Every written form of a handle the custom field search looks for, each with and without a trailing slash. */
export function instagramStoredVariants(handle: string): string[] {
	return INSTAGRAM_STORED_PREFIXES.flatMap((prefix) => [
		`${prefix}${handle}`,
		`${prefix}${handle}/`,
	]);
}

/** Largest Instagram custom field search: 10 pages of 500 leads. Hitting it fails the item. */
const INSTAGRAM_CUSTOM_FIELD_MAX_PAGES = 10;
const INSTAGRAM_CUSTOM_FIELD_MAX_LEADS = INSTAGRAM_CUSTOM_FIELD_MAX_PAGES * LIST_PAGE_SIZE;

const CUSTOM_FIELD_TYPE_LABELS: Record<string, string> = {
	number: 'number',
	boolean: 'boolean',
	enum: 'select',
	local_date: 'date',
	instant: 'date and time',
};

interface InstagramCustomFieldSearch {
	fieldKey: string;
	filterExpression: IDataObject;
	inputsByHandle: Map<string, string[]>;
	variantsByHandle: Map<string, Set<string>>;
}

function readLeadFilterFields(
	ctx: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	context.leadFilterFields ??= newarApiRequest
		.call(ctx, {
			method: 'GET',
			path: '/v1/lead-fields',
			itemIndex,
		})
		.then((response) => {
			if (!Array.isArray(response.data) || !response.data.every(isDataObject)) {
				throw new NodeOperationError(
					ctx.getNode(),
					'Newar returned an unexpected lead field list',
					{
						itemIndex,
						description: 'Expected data to be an array of custom field records.',
					},
				);
			}
			return response.data as IDataObject[];
		});
	return context.leadFilterFields;
}

function compileLeadFilterExpression(
	ctx: IExecuteFunctions,
	itemIndex: number,
	groups: unknown,
	catalog: LeadFilterField[],
	timeZone: string,
): IDataObject {
	try {
		return buildLeadFilterExpression(groups, catalog, timeZone);
	} catch (error) {
		if (error instanceof LeadFilterExpressionError) {
			throw new NodeOperationError(ctx.getNode(), error.message, { itemIndex });
		}
		throw new NodeOperationError(
			ctx.getNode(),
			error instanceof Error ? error.message : 'Could not compile the lead filter expression',
			{ itemIndex },
		);
	}
}

/**
 * Validates the Instagram values and field before any search request, so an
 * invalid handle or a select field fails the item instead of calling the API.
 */
async function prepareInstagramCustomFieldSearch(
	ctx: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
	instagram: string[],
	instagramField: string,
): Promise<InstagramCustomFieldSearch | undefined> {
	if (instagram.length === 0 || instagramField === '') return undefined;
	const inputsByHandle = new Map<string, string[]>();
	for (const input of instagram) {
		const handle = normalizeInstagramHandle(input);
		if (!handle) {
			throw new NodeOperationError(ctx.getNode(), `'${input}' is not a valid Instagram handle`, {
				itemIndex,
				description:
					'Use a username such as ana_souza, or a profile URL such as instagram.com/ana_souza.',
			});
		}
		const inputs = inputsByHandle.get(handle) ?? [];
		if (!inputs.includes(input)) inputs.push(input);
		inputsByHandle.set(handle, inputs);
	}
	const customFields = await readLeadFilterFields(ctx, itemIndex, context);
	const fieldKey = instagramField.startsWith('cf:')
		? instagramField.slice('cf:'.length)
		: instagramField;
	const catalog = leadFilterCatalog(customFields);
	const field = catalog.find((entry) => entry.id === `cf:${fieldKey}`);
	if (!field) {
		const known = customFields.some(
			(entry) => typeof entry.key === 'string' && entry.key === fieldKey,
		);
		throw new NodeOperationError(
			ctx.getNode(),
			known
				? `Instagram Field '${instagramField}' has an unsupported type`
				: `Instagram Field '${instagramField}' was not found`,
			{
				itemIndex,
				description: known
					? 'Choose a text custom field that stores the Instagram username, or leave Instagram Field empty to only match Instagram conversations.'
					: 'Refresh the Instagram Field list and choose a custom field from the list.',
			},
		);
	}
	if (field.type !== 'text') {
		throw new NodeOperationError(
			ctx.getNode(),
			`Instagram Field '${instagramField}' is a ${CUSTOM_FIELD_TYPE_LABELS[field.type] ?? field.type} field`,
			{
				itemIndex,
				description:
					'Choose a text custom field that stores the Instagram username, or leave Instagram Field empty to only match Instagram conversations.',
			},
		);
	}
	// One `in` per handle inside an `any` group: 16 values each, far below the
	// grammar limits. The compiler adds the required is_present guard.
	const variantsByHandle = new Map<string, Set<string>>();
	for (const handle of inputsByHandle.keys()) {
		variantsByHandle.set(handle, new Set(instagramStoredVariants(handle)));
	}
	const groups = {
		group: [...variantsByHandle.values()].map((variants) => ({
			conditions: {
				condition: [{ field: field.id, operator: 'in', value: [...variants].join(',') }],
			},
		})),
	};
	return {
		fieldKey,
		filterExpression: compileLeadFilterExpression(
			ctx,
			itemIndex,
			groups,
			catalog,
			context.timeZone,
		),
		inputsByHandle,
		variantsByHandle,
	};
}

async function queryInstagramCustomFieldLeads(
	ctx: IExecuteFunctions,
	itemIndex: number,
	filterExpression: IDataObject,
): Promise<IDataObject[]> {
	const leads: IDataObject[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;
	for (let page = 0; page < INSTAGRAM_CUSTOM_FIELD_MAX_PAGES; page++) {
		const result = await fetchPage.call(
			ctx,
			{
				method: 'POST',
				path: '/v1/leads/query',
				isRead: true,
				body: { filter_expression: filterExpression },
				itemIndex,
			},
			cursor,
			LIST_PAGE_SIZE,
		);
		if (!result.items.every(isLeadRecord)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'Newar returned an unexpected Instagram custom-field search response',
				{
					itemIndex,
					description: 'Expected every search result to include a lead ID.',
				},
			);
		}
		leads.push(...result.items);
		if (!result.nextCursor) return leads;
		if (seenCursors.has(result.nextCursor)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'Newar returned a repeated pagination cursor, so Instagram custom-field results may be incomplete.',
				{
					itemIndex,
					description:
						'No partial results were returned. Contact Newar API support with this execution ID.',
				},
			);
		}
		seenCursors.add(result.nextCursor);
		cursor = result.nextCursor;
	}
	throw new NodeOperationError(
		ctx.getNode(),
		`Instagram custom field search matched more than ${INSTAGRAM_CUSTOM_FIELD_MAX_LEADS} leads`,
		{
			itemIndex,
			description: 'Add more specific Instagram values and run the search again.',
		},
	);
}

/** Matches the stored custom field value against the written forms of each input handle. */
function instagramCustomFieldMatches(
	search: InstagramCustomFieldSearch,
	lead: IDataObject,
	ctx: IExecuteFunctions,
	itemIndex: number,
): IDataObject[] {
	const customFields = lead.custom_fields;
	if (typeof customFields !== 'object' || customFields === null || Array.isArray(customFields)) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Newar returned an unexpected Instagram custom-field search response',
			{ itemIndex, description: 'Expected each matched lead to include its custom_fields object.' },
		);
	}
	const stored = (customFields as IDataObject)[search.fieldKey];
	if (typeof stored !== 'string') {
		throw new NodeOperationError(
			ctx.getNode(),
			'Newar returned an unexpected Instagram custom-field search response',
			{
				itemIndex,
				description: `Expected the '${search.fieldKey}' custom field to contain a text value.`,
			},
		);
	}
	const matches: IDataObject[] = [];
	for (const [handle, inputs] of search.inputsByHandle) {
		if (!search.variantsByHandle.get(handle)?.has(stored)) continue;
		for (const input of inputs) {
			matches.push({
				field: 'instagram',
				value: input,
				matched_value: stored,
				source: 'custom_field',
			});
		}
	}
	return matches;
}

function isSameMatch(left: IDataObject, right: IDataObject): boolean {
	return (
		left.field === right.field &&
		left.value === right.value &&
		left.matched_value === right.matched_value &&
		left.source === right.source
	);
}

async function executeContactSearch(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const phone = readCommaSeparatedValues(this, itemIndex, 'phone');
	const email = readCommaSeparatedValues(this, itemIndex, 'email');
	const instagram = readCommaSeparatedValues(this, itemIndex, 'instagram');
	if (phone.length + email.length + instagram.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Fill in at least one contact value', {
			itemIndex,
			description: 'Enter a Phone, Email, or Instagram value before running this search.',
		});
	}
	const rawInstagramField = this.getNodeParameter('instagramField', itemIndex, '') as unknown;
	if (
		rawInstagramField !== undefined &&
		rawInstagramField !== null &&
		typeof rawInstagramField !== 'string'
	) {
		throw new NodeOperationError(this.getNode(), 'Instagram Field must be text', {
			itemIndex,
			description: 'Choose a custom field from the list or leave it empty.',
		});
	}
	const instagramField = typeof rawInstagramField === 'string' ? rawInstagramField.trim() : '';
	const matchMode = this.getNodeParameter('contactMatch', itemIndex, 'any') as string;
	if (matchMode !== 'any' && matchMode !== 'all') {
		throw new NodeOperationError(this.getNode(), `Unknown Contact Match option '${matchMode}'`, {
			itemIndex,
			description: "Choose 'Any Value' or 'All Filled Fields'.",
		});
	}
	const customFieldSearch = await prepareInstagramCustomFieldSearch(
		this,
		itemIndex,
		context,
		instagram,
		instagramField,
	);
	const response = await newarApiRequest.call(this, {
		method: 'GET',
		path: '/v1/leads/match',
		isRead: true,
		qs: {
			...(phone.length > 0 ? { phone: phone.join(',') } : {}),
			...(email.length > 0 ? { email: email.join(',') } : {}),
			...(instagram.length > 0 ? { instagram: instagram.join(',') } : {}),
		},
		itemIndex,
	});
	const data = response.data as unknown;
	const additionalData: unknown = response.additionalData;
	if (
		(additionalData !== undefined && !isDataObject(additionalData)) ||
		(isDataObject(additionalData) &&
			additionalData.truncated !== undefined &&
			typeof additionalData.truncated !== 'boolean')
	) {
		throw new NodeOperationError(
			this.getNode(),
			'Newar returned an unexpected Contact search response',
			{
				itemIndex,
				description: 'Expected additional_data.truncated to be a boolean when provided.',
			},
		);
	}
	if (response.additionalData?.truncated === true) {
		throw new NodeOperationError(this.getNode(), 'Contact search matched more than 100 leads', {
			itemIndex,
			description: 'Add more specific contact values and run the search again.',
		});
	}
	if (!isDataObject(data) || !Array.isArray(data.items)) {
		throw new NodeOperationError(
			this.getNode(),
			'Newar returned an unexpected Contact search response',
			{
				itemIndex,
				description: 'Expected data.items to be an array of matched leads.',
			},
		);
	}
	const unvalidatedHits = data.items as unknown[];
	if (!unvalidatedHits.every(isContactSearchHit)) {
		throw new NodeOperationError(
			this.getNode(),
			'Newar returned an unexpected Contact search response',
			{
				itemIndex,
				description: 'Each data.items entry must include item, matched_by, and matches.',
			},
		);
	}
	const mergedHits = [...unvalidatedHits];
	if (customFieldSearch) {
		const customFieldLeads = await queryInstagramCustomFieldLeads(
			this,
			itemIndex,
			customFieldSearch.filterExpression,
		);
		const hitsById = new Map<string, ContactSearchHit>();
		for (const hit of mergedHits) hitsById.set(String(hit.item.id), hit);
		for (const lead of customFieldLeads) {
			const matches = instagramCustomFieldMatches(customFieldSearch, lead, this, itemIndex);
			if (matches.length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					'Newar returned an Instagram field result that did not match the requested values',
					{
						itemIndex,
						description:
							'Refresh the custom field values or contact support if this keeps happening.',
					},
				);
			}
			const existing = hitsById.get(String(lead.id));
			if (existing) {
				if (!existing.matched_by.includes('instagram')) existing.matched_by.push('instagram');
				for (const match of matches) {
					if (!existing.matches.some((entry) => isSameMatch(entry, match))) {
						existing.matches.push(match);
					}
				}
			} else {
				const hit: ContactSearchHit = { item: lead, matched_by: ['instagram'], matches };
				hitsById.set(String(lead.id), hit);
				mergedHits.push(hit);
			}
		}
	}
	const requiredFields = [
		...(phone.length > 0 ? ['phone'] : []),
		...(email.length > 0 ? ['email'] : []),
		...(instagram.length > 0 ? ['instagram'] : []),
	];
	const hits =
		matchMode === 'all'
			? mergedHits.filter((hit) => requiredFields.every((field) => hit.matched_by.includes(field)))
			: mergedHits;
	const mode = this.getNodeParameter('output', itemIndex, 'simplified') as OutputMode;
	const fields =
		mode === 'fields' ? (this.getNodeParameter('fields', itemIndex, []) as string[]) : [];
	return hits.map((hit) => ({
		...applyOutput(hit.item, 'lead', mode, fields),
		matched_by: hit.matched_by,
		matches: hit.matches,
	}));
}

function isDataObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLeadRecord(value: unknown): value is IDataObject {
	return isDataObject(value) && typeof value.id === 'string' && value.id.trim() !== '';
}

function isLeadTextSearchHit(value: unknown): boolean {
	return (
		isDataObject(value) &&
		isLeadRecord(value.item) &&
		typeof value.result_score === 'number' &&
		Number.isFinite(value.result_score) &&
		value.result_score >= 0 &&
		value.result_score <= 1
	);
}

interface ContactSearchHit extends IDataObject {
	item: IDataObject;
	matched_by: string[];
	matches: IDataObject[];
}

function isContactSearchHit(value: unknown): value is ContactSearchHit {
	return (
		isDataObject(value) &&
		isLeadRecord(value.item) &&
		Array.isArray(value.matched_by) &&
		value.matched_by.length > 0 &&
		value.matched_by.every((field) => ['phone', 'email', 'instagram'].includes(String(field))) &&
		Array.isArray(value.matches) &&
		value.matches.every(isContactSearchMatch)
	);
}

function isContactSearchMatch(value: unknown): value is IDataObject {
	return (
		isDataObject(value) &&
		['phone', 'email', 'instagram'].includes(String(value.field)) &&
		typeof value.value === 'string' &&
		typeof value.matched_value === 'string' &&
		['primary', 'additional', 'instagram_conversation'].includes(String(value.source))
	);
}

async function executeConditionsSearch(
	this: IExecuteFunctions,
	itemIndex: number,
	timeZone: string,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const groups = this.getNodeParameter('filterGroups', itemIndex, {}) as unknown;
	let customFields: IDataObject[] = [];
	if (hasCustomLeadFilterField(groups)) {
		customFields = await readLeadFilterFields(this, itemIndex, context);
	}
	const filterExpression = compileLeadFilterExpression(
		this,
		itemIndex,
		groups,
		leadFilterCatalog(customFields),
		timeZone,
	);
	const hits = await newarApiRequestAllItems.call(
		this,
		{
			method: 'POST',
			path: '/v1/leads/query',
			isRead: true,
			body: { filter_expression: filterExpression },
			itemIndex,
			maxPageSize: LIST_PAGE_SIZE,
			itemsAt: 'data',
		},
		readPaging(this, itemIndex),
	);
	if (!hits.every(isLeadRecord)) {
		throw new NodeOperationError(
			this.getNode(),
			'Newar returned an unexpected Conditions search response',
			{
				itemIndex,
				description: 'Expected every Conditions search result to include a lead ID.',
			},
		);
	}
	const mode = this.getNodeParameter('output', itemIndex, 'simplified') as OutputMode;
	const fields =
		mode === 'fields' ? (this.getNodeParameter('fields', itemIndex, []) as string[]) : [];
	return hits.map((lead) => applyOutput(lead, 'lead', mode, fields));
}

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
	context: ExecutionContext,
): Promise<IDataObject[]> {
	const searchBy = this.getNodeParameter('searchBy', itemIndex, 'text') as string;
	if (searchBy !== 'text' && searchBy !== 'contact' && searchBy !== 'conditions') {
		throw new NodeOperationError(this.getNode(), `Unknown Search By option '${searchBy}'`, {
			itemIndex,
			description: "Choose 'Text', 'Contact', or 'Conditions'.",
		});
	}
	if (searchBy === 'contact') return await executeContactSearch.call(this, itemIndex, context);
	if (searchBy === 'conditions') {
		return await executeConditionsSearch.call(this, itemIndex, context.timeZone, context);
	}
	return await executeTextSearch.call(this, itemIndex);
}
