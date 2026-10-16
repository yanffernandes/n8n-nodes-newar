import type { IDataObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { router } from '../nodes/Newar/actions/router';
import { executeContext, LEAD_ID, locator, ok, type FakeResponse } from './support/context';

const EXISTING_LEAD = {
	id: LEAD_ID,
	name: 'Wotson Valadão',
	email: 'wotson@example.com',
	phone: '559193397569',
	company: 'Colégio Sol',
};

/** A 409 shaped exactly like the API contract for `contact_exists`. */
function contactExists(
	matchedBy: string[] = ['phone'],
	existingLead: unknown = EXISTING_LEAD,
): FakeResponse {
	const body: Record<string, unknown> = {
		success: false,
		error: {
			code: 'contact_exists',
			message:
				'Este telefone já pertence ao contato Wotson Valadão. Atualize esse contato em vez de criar outro.',
			details: matchedBy.map((field) => ({
				field,
				message:
					field === 'phone'
						? 'Este telefone já pertence a outro lead.'
						: 'Este e-mail já pertence a outro lead.',
			})),
		},
		lead_id: LEAD_ID,
		matched_by: matchedBy,
	};
	if (existingLead !== undefined && existingLead !== null) body.existing_lead = existingLead;
	return { statusCode: 409, body };
}

function createParameters(extra: IDataObject = {}): IDataObject {
	return {
		resource: 'lead',
		operation: 'create',
		name: 'Wotson Valadao',
		additionalFields: { phone: '5591993397569' },
		leadCustomFields: { mappingMode: 'defineBelow', value: null },
		options: {},
		...extra,
	};
}

describe('Lead > Create with If Lead Already Exists', () => {
	it('fails with the existing lead by default', async () => {
		const { context } = executeContext({
			parameters: createParameters(),
			respond: () => contactExists(),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe(
			'This phone already belongs to the lead "Wotson Valadão"',
		);
	});

	it('fails with the existing lead when Stop With Error is set', async () => {
		const { context } = executeContext({
			parameters: createParameters({ ifLeadExists: 'error' }),
			respond: () => contactExists(['email']),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe(
			'This email already belongs to the lead "Wotson Valadão"',
		);
	});

	it('returns the existing lead with already_existed and matched_by', async () => {
		const { context } = executeContext({
			parameters: createParameters({ ifLeadExists: 'returnExisting' }),
			respond: () => contactExists(['phone']),
		});

		const output = await router.call(context);

		expect(output[0][0].json).toEqual({
			...EXISTING_LEAD,
			already_existed: true,
			matched_by: ['phone'],
		});
	});

	it('marks a created lead with already_existed false', async () => {
		const { context } = executeContext({
			parameters: createParameters({ ifLeadExists: 'returnExisting' }),
			respond: () => ok(EXISTING_LEAD),
		});

		const output = await router.call(context);

		expect(output[0][0].json).toEqual({ ...EXISTING_LEAD, already_existed: false });
	});

	it('keeps the created lead unchanged on the default', async () => {
		const { context } = executeContext({
			parameters: createParameters(),
			respond: () => ok(EXISTING_LEAD),
		});

		const output = await router.call(context);

		expect(output[0][0].json).toEqual(EXISTING_LEAD);
	});

	it('still fails when the conflict carries no lead', async () => {
		const { context } = executeContext({
			parameters: createParameters({ ifLeadExists: 'returnExisting' }),
			respond: () => contactExists(['phone'], null),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('This phone already belongs to another lead');
	});

	it('rethrows other errors even with Return Existing Lead', async () => {
		const { context } = executeContext({
			parameters: createParameters({ ifLeadExists: 'returnExisting' }),
			respond: () => ({
				statusCode: 422,
				body: { success: false, error: { code: 'validation_error', message: 'Inválido.' } },
			}),
		});

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Newar rejected the data sent');
	});

	it('sends the Idempotency-Key on the conflicting create, so a retry replays', async () => {
		const { context, requests } = executeContext({
			parameters: createParameters({ ifLeadExists: 'returnExisting' }),
			respond: () => contactExists(),
		});

		await router.call(context);

		expect(requests).toHaveLength(1);
		expect((requests[0].headers as Record<string, string>)['Idempotency-Key']).toMatch(
			/^n8n-[0-9a-f]{40}$/,
		);
	});
});

describe('Lead > Update contact_exists', () => {
	it('fails with the other lead and the next step', async () => {
		const parameters = {
			resource: 'lead',
			operation: 'update',
			leadId: locator('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'),
			updateFields: { phone: '5591993397569' },
			leadCustomFieldsUpdate: { mappingMode: 'defineBelow', value: null },
		};
		const { context } = executeContext({ parameters, respond: () => contactExists() });

		const error = await router.call(context).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe(
			'This phone already belongs to the lead "Wotson Valadão"',
		);
		expect((error as NodeApiError).description).toContain('Remove it from this update');
		expect((error as NodeApiError).description).toContain('merge the two leads in Newar');
		expect((error as NodeApiError).description).not.toContain("'If Lead Already Exists'");
	});
});

describe('contact_exists with Continue On Fail', () => {
	it('carries code, existing_lead and matched_by in the error item', async () => {
		const { context } = executeContext({
			parameters: createParameters(),
			respond: () => contactExists(['phone', 'email']),
			continueOnFail: true,
		});

		const output = await router.call(context);

		expect(output[0][0].json).toMatchObject({
			error: 'This phone or email already belongs to the lead "Wotson Valadão"',
			httpCode: '409',
			code: 'contact_exists',
			matched_by: ['phone', 'email'],
			existing_lead: EXISTING_LEAD,
		});
		expect(output[0][0].json.description).toContain('Use Lead > Update with this ID');
	});

	it('carries code and matched_by when the lead is hidden', async () => {
		const { context } = executeContext({
			parameters: createParameters(),
			respond: () => contactExists(['phone'], null),
			continueOnFail: true,
		});

		const output = await router.call(context);

		expect(output[0][0].json).toMatchObject({
			error: 'This phone already belongs to another lead',
			code: 'contact_exists',
			matched_by: ['phone'],
		});
		expect(output[0][0].json.existing_lead).toBeUndefined();
	});
});
