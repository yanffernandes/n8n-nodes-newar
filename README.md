# n8n-nodes-newar

This is an [n8n](https://n8n.io/) community node package for **[Newar](https://newar.com.br)**, a CRM for sales teams. It lets your workflows create, read, update, search and delete Newar leads, deals, tasks, notes and tags, and start workflows when something changes in Newar.

The package contains two nodes:

- **Newar**: 34 operations on 11 resources. It also works as a tool for the n8n AI Agent.
- **Newar Trigger**: starts a workflow when leads, deals, tasks or notes are created or change.

Everything goes through the [Newar public API](https://app.newar.com.br/api-docs), with the same rules, history and automations as the Newar app.

[Installation](#installation) ·
[Credentials](#credentials) ·
[Operations](#operations) ·
[Newar Trigger](#newar-trigger) ·
[Idempotency](#idempotency-no-duplicate-records) ·
[Rate limits](#rate-limits) ·
[Errors](#errors) ·
[Examples](#examples) ·
[Compatibility](#compatibility) ·
[Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) of n8n.

**From the n8n editor** (self-hosted, owner or admin):

1. Go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-newar`, accept the risks, and select **Install**.

**With npm** (queue mode, or when you manage packages by hand):

```sh
cd ~/.n8n/nodes
npm install n8n-nodes-newar
# then restart n8n
```

In Docker, run these commands inside the container (`docker exec -it n8n sh`).

> Until n8n verifies this package, n8n 3.x only loads it when `N8N_UNVERIFIED_PACKAGES_ENABLED=true`.

## Credentials

The nodes use one credential, **Newar API**:

| Field | What to enter |
|---|---|
| **API Token** | A token created in Newar under **Settings > API**. Newar shows it only once. |
| **Base URL** | Leave the default, `https://api.newar.com.br/functions/v1/api`. Change it only to test against another environment. |

Newar has two kinds of token:

| Prefix | Scope | Can |
|---|---|---|
| `nw_r_` | Read-only | Get, Get Many, Search, and the trigger |
| `nw_rw_` | Read and write | Everything, including Create, Update and Delete |

The token acts as the Newar user who created it, with that user's role: leads and lead notes need the **Leads** permission, deals and deal notes need **Pipeline**, tasks need **Tasks**. If the user loses a permission or leaves the workspace, the token loses it too. Revoke tokens in **Settings > API**.

When you save the credential, n8n tests it with `GET /v1/me`. The **User > Get Current** operation returns the same information: the user, the workspace, the token scope and the role permissions.

Use a read-only token for workflows that only read, and for AI agents that should not change data.

## Operations

| Resource | Operations |
|---|---|
| **Lead** (the contact, the person) | Create, Delete, Get, Get Many, Search, Update |
| **Deal** (an opportunity of a lead) | Create, Delete, Get, Get Many, Search, Update |
| **Task** | Create, Delete, Get, Get Many, Update |
| **Note** | Create, Get, Get Many |
| **Tag** | Create, Delete, Get Many, Update (rename) |
| **Pipeline** | Get, Get Many (each pipeline comes with its stages) |
| **Stage** | Get, Get Many (all stages, or the stages of one pipeline) |
| **User** | Get, Get Many, Get Current (the user and permissions of the token) |
| **Custom Field** | Get Many (lead or deal fields, with keys, types and options) |
| **Loss Reason** | Get Many |
| **Search** | Search Records (leads, deals and tasks at once) |

Notes on how they behave:

- **Create** has the same effects as the app. A new lead enters the first open stage of the first pipeline (or the stage you pick), gets its primary deal when the workspace creates one automatically, and triggers the "lead captured" automations. Newar does not merge duplicates: use **Lead > Search** by email or phone first if you don't want a second lead.
- **Update** only changes the fields you add under **Update Fields**. A field you add and leave empty is cleared when Newar allows it (email, phone, company, owner, next step, due dates, observations). On a lead, **Tags** replaces the whole list, and an empty list removes every tag. Moving a lead to a stage also moves its primary deal.
- **Deal > Update** wins (`Won`), loses (`Lost`, with an optional loss reason and comment) or reopens (`Open`) a deal. A won or lost deal only moves to another stage together with **Status: Open**. A lead's **primary deal** (`is_primary`) mirrors the lead: change its title, value, owner and next step with **Lead > Update**.
- **Delete** is reversible in Newar: the record leaves lists and searches, Newar's support can restore it, and the node returns `{ "id": "...", "deleted": true }`. Deleting a lead also deletes its deals. A lead's primary deal can't be deleted on its own. Only tags that no record uses can be deleted.
- **Get Many** has **Return All** (reads every page, 500 per request, keeping your filters and sort on every page) and **Limit** (default 50). Leads, deals and tasks have filters (owner, pipeline, stage, tag, status, type, due dates, `Updated Since`/`Updated Before`, up to 100 IDs) and a **Sort** option.
- **Search** (lead and deal) ignores accents and case, needs at least 2 characters, and adds a `result_score` from 0 to 1 to each result. **Search > Search Records** looks at leads, deals and tasks like the app's search bar and needs at least 3 characters.
- **Output**: Get, Get Many and Search of leads, deals and tasks return a **Simplified** record by default (the 10 most useful fields). Choose **Raw** for every field, including custom fields and UTM data, or **Selected Fields** to pick them (the ID is always included).

### Picking records

Fields that point at one record (Lead, Deal, Task, Note, Tag, Pipeline, Stage, User) let you choose **From List** or enter the ID (**By ID**). In the list, typing 2 or more characters searches leads and deals by name, email, phone or title; otherwise it shows the most recently updated records. Newar IDs are UUIDs, and the node checks them before calling Newar.

Dropdowns inside **Additional Fields**, **Update Fields** and **Filters** (owner, pipeline, stage, tags, loss reason, the deal of a task) load from Newar. The stage list follows the pipeline you picked in the same node.

### Custom fields

Lead and deal **Create** and **Update** have a **Custom Fields** section filled from your Newar workspace (**Settings > Fields**):

| Newar type | Input in n8n | Sent as |
|---|---|---|
| Text | Text | Text |
| Number | Number | Number |
| Date | Date picker | `YYYY-MM-DD` (only the date is used) |
| Select | Dropdown with the field's options | The option label, as written in Newar |
| Boolean | Toggle | `true` or `false` |

On **Create**, every field is listed and empty ones are skipped. On **Update**, add only the fields you want to change; a field you add and leave empty is cleared. Newar checks each value against the field type and answers with the field name when one is wrong. **Custom Field > Get Many** lists the keys, types and options.

### Dates and time zones

Date-time values without a time zone (such as those from the date picker) are read in the workflow's time zone and sent to Newar in UTC. Values with an offset or `Z` keep their instant. Date-only fields (next step due date, date custom fields) keep the date as written, so a time zone never shifts the day.

## Newar Trigger

Newar has no webhooks yet, so the trigger checks Newar on the schedule you set in **Poll Times** (every minute by default) and sends each change once.

| Event | Starts the workflow when |
|---|---|
| **Lead Created** | A lead is created, in the app, by a form, by an integration or by the API |
| **Lead Updated** | A lead changes after it was created, including changes Newar makes on its own, such as automations |
| **Deal Created** | A deal is created |
| **Deal Updated** | A deal changes after it was created, including changes Newar makes on its own |
| **Deal Stage Changed** | A deal enters another stage (`stage_entered_at` changes) |
| **Deal Won** | A deal is marked as won (`closed_at`) |
| **Deal Lost** | A deal is marked as lost (`closed_at`) |
| **Task Created** | A task is created |
| **Task Completed** | A task is marked as done (`completed_at`) |
| **Note Created** | A note is added to a lead or a deal |

**Filters** narrow the events: owner, pipeline, stage and tag for leads; lead, owner, pipeline and stage for deals (with **Deal Stage Changed**, a stage filter means "entered this stage"); lead, assignee and task type for tasks; lead for notes. Filters run in Newar, so they don't cost extra requests.

How it works:

- **Activation.** The first check after you activate the workflow only records the time. Changes made before activation are not sent.
- **Each check** asks Newar for records changed since the last one it saw, oldest first, and reads 2 minutes back to catch records saved by slow transactions. It remembers what it sent, so nothing is sent twice. When nothing changed, a check costs one request.
- **Catching up.** If the workflow was off or n8n was down, the next checks send what changed in the meantime, reading up to 10 pages (5,000 records) per check.
- **Fetch Test Event** returns the most recent record that matches the event and the filters, and doesn't change what the trigger remembers.
- The output is the full record, as **Get** with **Output: Raw** returns it.

Limits of polling:

- **Deleted records are not reported.** The API does not expose deletions yet.
- A check only sees the current state of a record. If a deal is won and reopened between two checks, **Deal Won** doesn't fire; if a lead changes several times between two checks, **Lead Updated** fires once, with the latest data.
- Notes can't be filtered by date in the API, so **Note Created** reads the newest notes and stops at the last check. If more notes are created between two checks than it can read (10 pages of 100), it sends the newest and logs a warning.
- Every check uses the token's hourly budget (see [Rate limits](#rate-limits)). A trigger that checks every minute uses 60 requests per hour when nothing changes.

## Idempotency (no duplicate records)

Every **Create** (lead, deal, task, note, tag) sends an `Idempotency-Key` header. When Newar receives the same key again from the same token within 24 hours, it returns the response of the first request (with the header `Idempotent-Replayed: true`) instead of creating a second record, and no automation fires twice.

- **Default key.** Leave **Options > Idempotency Key** empty and the node derives a key from the n8n instance, workflow, execution, node, run, item and the request itself. When n8n retries a failed node (**Retry On Fail**), the key is the same, so a create that reached Newar before the failure is not duplicated. A new execution, another run of the node in a loop, or an AI agent calling the tool again gets a new key.
- **Your own key.** Set **Options > Idempotency Key** to a value that identifies the record in the source system, such as `{{ $json.orderId }}`. The same value then creates the record once, across executions and workflows, for 24 hours. This also covers **Retry** on a failed execution in the executions list, which starts a new execution. The node prefixes the key with the endpoint (`lead:`, `deal:`, ...), so the same external ID can protect both a Create Lead and a Create Deal. Values with spaces, accents or over 255 characters are hashed into a valid key.
- The same key with **different data** fails with *"This idempotency key was already used with different data"*: use a key that is unique per record. A create that failed (for example, a validation error) does not use up its key.

Updates and deletes don't need a key: repeating them has the same result.

## Rate limits

Each token can make **6,000 requests per hour**, in a fixed window that resets at the top of the hour. Every page of a Get Many, every lookup in a dropdown and every trigger check counts.

- When the limit is reached, the node **fails right away** with the time the limit resets. It doesn't wait, because the wait can be close to an hour. The error is declared as rate-limited, so recent n8n versions can back off polling triggers on their own.
- Keep heavy workflows under the limit: lower **Limit**, use filters and **Updated Since** instead of reading everything, spread large batches (for example with **Loop Over Items** and **Wait**), and give busy workflows their own token.
- When Newar is briefly busy it answers `503` with a `Retry-After` of 1 to 60 seconds. Turn on **Retry On Fail** in the node settings, with **Wait Between Tries** of at least that long. Creates are safe to retry (see [Idempotency](#idempotency-no-duplicate-records)).

## Errors

Newar answers errors with a stable code and a Portuguese message. The node shows an English message for each code and keeps Newar's message in the error description.

| Code | Message in n8n |
|---|---|
| `unauthorized` | Newar rejected the API token |
| `read_only_token` | This Newar token is read-only |
| `forbidden` | Your Newar user is not allowed to do this |
| `not_found` | The lead (deal, task, ...) was not found in Newar |
| `validation_error` | Newar rejected the value of *field, field* (with each problem in the description) |
| `conflict` | Newar refused the change because of the record's current state |
| `plan_limit_reached` | The Newar plan limit was reached |
| `tag_in_use` | The tag is still in use |
| `task_deal_invalid` | The deal doesn't belong to the task's lead |
| `idempotency_key_reused` | This idempotency key was already used with different data |
| `rate_limit_exceeded` | The Newar API rate limit was reached (with the reset time) |
| `temporarily_unavailable` | Newar is temporarily unavailable (with the wait Newar asked for) |
| `bad_request` | Newar could not read the request |
| `internal_error` | Newar had an internal problem |

With **Continue On Fail** (node setting **On Error: Continue**), a failed item becomes `{ "error": "...", "description": "...", "httpCode": "404" }` and the node goes on with the next item.

## Examples

- **Capture leads from a form.** *Form Trigger* > *Newar: Lead > Create*, with **Name**, **Email** and **Phone** mapped from the form, the lead source in **Additional Fields > Source**, and **Options > Idempotency Key** set to the submission ID, so a resubmitted form doesn't create a second lead.
- **Celebrate won deals.** *Newar Trigger* (**Deal Won**, filtered by pipeline) > *Newar: Lead > Get* with the deal's `lead_id` > a message to your team chat.
- **Follow up automatically.** *Newar Trigger* (**Deal Stage Changed**, filtered by the "Proposal sent" stage) > *Newar: Task > Create* for the deal's lead, with a **Due Date** of `{{ $now.plus(2, 'days') }}` and **Additional Fields > Deal** set to the deal's `id`.
- **Sync to a spreadsheet.** *Schedule Trigger* > *Newar: Lead > Get Many* with **Return All**, **Filters > Updated Since** `{{ $now.minus(1, 'hour') }}` and **Output: Raw** > *Google Sheets: Append or Update Row* keyed by `id`.

## Using the node as an AI tool

The **Newar** node can be connected to the n8n **AI Agent** as a tool. The default **Simplified** output keeps answers small for the model; use **Selected Fields** to control exactly what the agent sees. Consider a read-only token for agents that should only look things up.

## Compatibility

- n8n **1.85.0 or later** (the first release whose `n8n-workflow` exports `NodeConnectionTypes`).
- Built with `@n8n/node-cli` 0.49 and type-checked against `n8n-workflow` 2.40. Installed the way n8n installs community packages and run end to end, against a mock of the Newar API, on n8n 1.85.0 and 2.40.6: operations, retries, errors, the trigger, dropdowns, custom fields and the credential test.
- Newar API v1.1 or later for `Idempotency-Key` and the `read_only_token` code. On older API versions, creates still work, and a write with a read-only token is still explained correctly.
- No runtime dependencies. The package passes the n8n community node linter in strict mode (the rules n8n Cloud requires).

## Development

```sh
npm install
npm run lint       # n8n community node rules (strict)
npm run build      # compile to dist/
npm test           # unit tests (Vitest)
npm run typecheck  # type-check the tests
npm run dev        # run n8n locally with the nodes loaded
```

Releases are published to npm with provenance by the **Publish** GitHub Actions workflow when a version tag (for example `0.1.0`) is pushed. See `.github/workflows/publish.yml`.

## Resources

- [Newar API documentation](https://app.newar.com.br/api-docs) (inside the Newar app)
- [Newar OpenAPI specification](https://api.newar.com.br/functions/v1/api/v1/openapi.json)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Issues and feature requests](https://github.com/yanffernandes/n8n-nodes-newar/issues)

## License

[MIT](LICENSE.md)
