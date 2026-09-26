# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/).

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
