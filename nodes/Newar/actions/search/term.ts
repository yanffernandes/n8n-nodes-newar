import type { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** The "Search Term" parameter shared by the searches. */
export function searchTermProperty(description: string, minLength: number): INodeProperties {
	return {
		displayName: 'Search Term',
		name: 'term',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. ana souza',
		description: `${description}. At least ${minLength} characters.`,
	};
}

/** Reads the search term and checks the minimum length Newar requires. */
export function readSearchTerm(
	ctx: IExecuteFunctions,
	itemIndex: number,
	minLength: number,
): string {
	const raw = ctx.getNodeParameter('term', itemIndex, '') as unknown;
	const term = (typeof raw === 'string' ? raw : String(raw ?? '')).trim();
	if (term.length < minLength) {
		throw new NodeOperationError(
			ctx.getNode(),
			`'Search Term' needs at least ${minLength} characters`,
			{ itemIndex, description: `Got '${term}'.` },
		);
	}
	if (term.length > 200) {
		throw new NodeOperationError(ctx.getNode(), "'Search Term' accepts up to 200 characters", {
			itemIndex,
		});
	}
	return term;
}
