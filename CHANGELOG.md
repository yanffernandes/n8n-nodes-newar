# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/).

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
