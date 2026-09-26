import { describe, expect, it } from 'vitest';

import { InvalidParameterError } from '../nodes/Newar/helpers/fields';
import {
	createUserResolver,
	resolveUserParameters,
	type NewarUser,
} from '../nodes/Newar/helpers/owner';

const KAWA_ID = '5c1d7e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const ANA_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_ANA_ID = '6f5e4d3c-2b1a-4f9e-8d7c-6b5a4f3e2d1c';
const UNLISTED_ID = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';

const USERS: NewarUser[] = [
	{ id: KAWA_ID, name: 'Kawã Lima', email: 'kawa@example.com' },
	{ id: ANA_ID, name: 'Ana Souza', email: 'ana@example.com' },
	{ id: OTHER_ANA_ID, name: 'Ána  Souza', email: 'ana.souza@example.com' },
	{ id: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e', name: null, email: 'bia@example.com' },
];

/** A resolver over USERS that records each time it reads the users. */
function resolverWithUsers() {
	const loads: number[] = [];
	const resolveUser = createUserResolver(async (itemIndex) => {
		loads.push(itemIndex);
		return USERS;
	});
	return { resolveUser, loads };
}

describe('createUserResolver', () => {
	it('sends an ID as it is, without reading the users', async () => {
		const { resolveUser, loads } = resolverWithUsers();

		const result = await resolveUser(UNLISTED_ID, 'Owner', 0);

		expect(result).toBe(UNLISTED_ID);
		expect(loads).toHaveLength(0);
	});

	it('finds the user of an email, without case', async () => {
		const { resolveUser } = resolverWithUsers();

		const result = await resolveUser(' KAWA@Example.com ', 'Owner', 0);

		expect(result).toBe(KAWA_ID);
	});

	it('finds the user of a full name, without accents, case or extra spaces', async () => {
		const { resolveUser } = resolverWithUsers();

		const result = await resolveUser('  kawa   LIMA ', 'Owner', 0);

		expect(result).toBe(KAWA_ID);
	});

	it('does not pick a user from part of a name', async () => {
		const { resolveUser } = resolverWithUsers();

		const result = resolveUser('Kawã', 'Owner', 0);

		await expect(result).rejects.toThrow(
			"No Newar user matches 'Kawã'. Use the user ID, email or full name.",
		);
	});

	it('refuses a name that more than one user has', async () => {
		const { resolveUser } = resolverWithUsers();

		const result = resolveUser('ana souza', 'Owner', 0);

		await expect(result).rejects.toThrow(
			"More than one Newar user is named 'ana souza'. Use the email or the ID.",
		);
	});

	it('refuses a value no user matches, naming the parameter', async () => {
		const { resolveUser } = resolverWithUsers();

		const error = await resolveUser('zoe@example.com', 'Assignee', 0).catch(
			(caught: unknown) => caught,
		);

		expect(error).toBeInstanceOf(InvalidParameterError);
		expect(error).toMatchObject({
			parameter: 'Assignee',
			message: "No Newar user matches 'zoe@example.com'. Use the user ID, email or full name.",
		});
	});

	it('leaves an empty value as it is, without reading the users', async () => {
		const { resolveUser, loads } = resolverWithUsers();

		const blank = await resolveUser('  ', 'Owner', 0);
		const missing = await resolveUser(null, 'Owner', 0);

		expect(blank).toBe('  ');
		expect(missing).toBeNull();
		expect(loads).toHaveLength(0);
	});

	it('reads the users once for every value it resolves', async () => {
		const { resolveUser, loads } = resolverWithUsers();

		await resolveUser('kawa@example.com', 'Owner', 0);
		await resolveUser('Kawã Lima', 'Assignee', 1);
		await resolveUser('bia@example.com', 'Owner', 2);

		expect(loads).toEqual([0]);
	});
});

describe('resolveUserParameters', () => {
	it('turns the owner into a user ID and keeps the other fields', async () => {
		const { resolveUser } = resolverWithUsers();
		const values = { ownerId: 'kawa@example.com', email: 'lead@example.com' };

		const result = await resolveUserParameters(values, resolveUser, 0);

		expect(result).toEqual({ ownerId: KAWA_ID, email: 'lead@example.com' });
	});

	it('turns the assignee into a user ID', async () => {
		const { resolveUser } = resolverWithUsers();
		const values = { assignedToId: 'Kawa Lima' };

		const result = await resolveUserParameters(values, resolveUser, 0);

		expect(result).toEqual({ assignedToId: KAWA_ID });
	});

	it('does not read the users when no user parameter was added', async () => {
		const { resolveUser, loads } = resolverWithUsers();
		const values = { email: 'lead@example.com' };

		const result = await resolveUserParameters(values, resolveUser, 0);

		expect(result).toEqual(values);
		expect(loads).toHaveLength(0);
	});
});
