# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-10-16

Needs the Newar API 2.2.0 or newer, which adds `GET /v1/leads/match` and the `contact_exists` error.

### Added

- **Lead > Search** has a **Search By** option. **Text** is the search you already use, unchanged. **Contact** finds the lead that owns a phone, email or Instagram handle with the same rule Newar uses to refuse a duplicate contact: phone in any format, with or without the 9th digit, the country code or punctuation, in the main and the additional phones, and email without case. Instagram matches the lead's Instagram conversations and, with **Instagram Field** set, that custom field in its common written forms, such as `@ana`, `instagram.com/ana` or `https://www.instagram.com/ana/`; comparisons on the custom field are case sensitive, as in the Newar app. Leads without a value in the selected custom field are skipped. **Match** returns leads that match any value, or only leads that match every filled field. Each lead comes with `matched_by` and `matches`, which say what matched. Leaving every contact field empty fails the item instead of returning nothing.
- **Conditions** filters leads with the operators of the Newar filters, such as is, contains, starts with and ends with, in groups: conditions inside a group must all match, and a lead matches when any group matches, so (A and B) or C is two groups. Fields are the Newar lead filter fields and the workspace custom fields. A condition that needs a value and has none fails the item, so an empty sheet cell never matches every lead. Custom-field conditions treat missing values as nonmatches for positive operators and matches for negative operators.
- **Lead > Create** has **If Lead Already Exists**. **Stop With Error** is the default and keeps the old behavior. **Return Existing Lead** continues the workflow with the lead that already owns the phone or email, marked with `already_existed: true` and `matched_by`. Created leads get `already_existed: false` in this mode.

### Changed

- When a phone or email already belongs to another lead, the error names that lead and shows its ID, phone, email, which field matched, a link to open it in Newar and the next step. With Continue On Fail, the error item also carries `code`, `existing_lead` and `matched_by`.

## [0.3.1] - 2026-09-26

### Changed

- The README explains the deal counts on leads, the phone in any format and a new example: update the open deal or create one, with `open_deals_count`.

## [0.3.0] - 2026-09-26

### Added

- Leads carry their deal counts, with the same names as Pipedrive: `deals_count` (all), `open_deals_count` (open), `won_deals_count` (won) and `lost_deals_count` (lost). A flow can decide between updating the open deal and creating a new one without another request. They count only the deals the token owner can see, and Selected Fields offers all four.

### Changed

- The simplified lead output brings `open_deals_count` in place of `next_step`. Use the Raw output, or add Next Step in Selected Fields, to keep reading it.
- **Phone** takes any format, such as `+55 (11) 99999-0000`, `(11) 99999-0000` or `5511999990000`. Newar keeps only the digits, with the country code, and assumes Brazil when it is missing. A phone without the area code fails with a message that says how to fix it.

## [0.2.0] - 2026-09-25

### Added

- **Lead > Search** looks for several values at once: separate up to 10 values with commas in **Search Term**, such as `ana souza, ana@example.com, 11999990000`. A lead is returned when it matches any of them, with the `result_score` of its best match. The whole term still needs 2 to 200 characters.
- The owner of leads and deals and the assignee of tasks also take the email or the full name of a Newar user in an expression, such as `{{ $json.ownerEmail }}`, in Create, Update and the Get Many filters. Emails are compared without case, and names whole, without accents or case. When no user or more than one user matches, the item fails with a message that shows the value and says what to use instead, and nothing is created or changed. The node reads the Newar users at most once per execution, and only when a value is not an ID.

### Changed

- These fields are now named **Owner Email, Name or ID** and **Assignee Email, Name or ID**. Existing workflows keep working: a user picked from the list is still sent as its ID.

## [0.1.1] - 2026-09-25

### Changed

- Links to the Newar API documentation, in the README and in the node's error messages, point to its public address, https://app.newar.com.br/api. It opens without a Newar login, and the old address still redirects there.
- The Newar link in the README and in the package metadata points to https://app.newar.com.br.

## [0.1.0] - 2026-09-24

First release.

### Added

- **Newar** node with 34 operations on 11 resources: Lead, Deal and Task (create, get, get many, update, delete, and search for leads and deals), Note (create, get, get many), Tag (create, rename, delete, get many), Pipeline, Stage, User (including the token's own user and permissions), Custom Field, Loss Reason, and a search across leads, deals and tasks.
- Record pickers with "From List" (searchable, paginated) and "By ID" (validated) modes.
- Custom fields of leads and deals as typed inputs loaded from the workspace, with create and update semantics that match the API (empty values are skipped on create and cleared on update).
- "Return All" that follows the API cursor while keeping every filter and sort, and a "Limit" for everything else.
- "Output" option (Simplified, Raw, Selected Fields) on reads of leads, deals and tasks, for regular workflows and AI agents.
- `Idempotency-Key` on every create: derived per execution, node, run and item so "Retry On Fail" never duplicates, or set to your own stable key to deduplicate across executions for 24 hours.
- English error messages for every API error code, with Newar's original message in the description, the rate limit reset time, and failure causes n8n can act on.
- **Newar Trigger** (polling) with ten events: Lead Created, Lead Updated, Deal Created, Deal Updated, Deal Stage Changed, Deal Won, Deal Lost, Task Created, Task Completed and Note Created, with server-side filters, deduplication and a bounded number of requests per check.
- **Newar API** credential with a connection test.
