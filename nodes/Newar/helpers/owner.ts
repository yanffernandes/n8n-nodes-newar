import type { IDataObject } from 'n8n-workflow';

import { InvalidParameterError, isUuid } from './fields';

/**
 * Owner and assignee values given as an ID, an email or a full name.
 *
 * A user picked from the list arrives as an ID and is sent as it is. An
 * expression can also give the email of a Newar user (compared without case)
 * or the full name (compared whole, without accents or case, with spaces
 * normalized), so "ana" never picks "Ana Souza". Two users with the same name
 * are never guessed: the node asks for the email or the ID instead.
 */

/** A member of the workspace, as `GET /v1/users` returns it. */
export interface NewarUser {
	id: string;
	name?: string | null;
	email?: string | null;
}

/** Reads the workspace users. `itemIndex` is the item that first needed them. */
export type UserLoader = (itemIndex: number) => Promise<NewarUser[]>;

/** Returns the user ID a value points to. IDs and empty values come back as they are. */
export type UserResolver = <T>(value: T, label: string, itemIndex: number) => Promise<T | string>;

/** Collection parameters that hold a user, with their labels. */
const USER_PARAMETERS: ReadonlyArray<readonly [parameter: string, label: string]> = [
	['assignedToId', 'Assignee'],
	['ownerId', 'Owner'],
];

/** How full names are compared: without accents or case, with single spaces. */
export function normalizeUserName(value: unknown): string {
	return String(value ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

function referenceText(value: unknown): string {
	return value === undefined || value === null ? '' : String(value).trim();
}

/** The users an email (without case) or a full name (without accents or case) points to. */
export function matchUsers(users: readonly NewarUser[], reference: string): NewarUser[] {
	if (reference.includes('@')) {
		const email = reference.toLowerCase();
		return users.filter((user) => referenceText(user.email).toLowerCase() === email);
	}
	const name = normalizeUserName(reference);
	if (name === '') return [];
	return users.filter((user) => normalizeUserName(user.name) === name);
}

function resolutionError(reference: string, label: string, matches: number): InvalidParameterError {
	if (matches === 0) {
		return new InvalidParameterError(
			label,
			`No Newar user matches '${reference}'. Use the user ID, email or full name.`,
			`'${label}' takes the ID, the email or the full name of a Newar user. Names are compared whole, without accents or case.`,
		);
	}
	return new InvalidParameterError(
		label,
		`More than one Newar user is named '${reference}'. Use the email or the ID.`,
		`'${label}' matches ${matches} users. User > Get Many lists the email and the ID of each one.`,
	);
}

/**
 * A resolver for one node execution. It reads the workspace users at most
 * once, and only when a value is an email or a name.
 */
export function createUserResolver(load: UserLoader): UserResolver {
	let users: Promise<NewarUser[]> | undefined;
	return async <T>(value: T, label: string, itemIndex: number): Promise<T | string> => {
		const reference = referenceText(value);
		if (reference === '' || isUuid(reference)) return value;
		users = users ?? load(itemIndex);
		const matches = matchUsers(await users, reference);
		if (matches.length === 1) return matches[0].id;
		throw resolutionError(reference, label, matches.length);
	};
}

/**
 * Copies a collection with its owner and assignee turned into user IDs. Empty
 * values stay as they are, so Create still skips them and Update still clears.
 */
export async function resolveUserParameters(
	values: IDataObject,
	resolveUser: UserResolver,
	itemIndex: number,
): Promise<IDataObject> {
	const resolved: IDataObject = { ...values };
	for (const [parameter, label] of USER_PARAMETERS) {
		if (parameter in resolved) {
			resolved[parameter] = await resolveUser(resolved[parameter], label, itemIndex);
		}
	}
	return resolved;
}
