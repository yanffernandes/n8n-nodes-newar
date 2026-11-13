# Lead search reliability

This note records the validated behavior and recovery path for **Lead > Search**.

## Conditions

- Conditions inside one group use AND; groups use OR.
- Required values are checked before the query. Errors identify the group, condition, and field.
- `in` values are comma-separated; blank entries are ignored, but an empty list is rejected.
- Number values use decimal notation. Boolean values use `true` or `false`; enum values must match an offered option.
- Local dates use `YYYY-MM-DD`. Instant values use `YYYY-MM-DD` or RFC3339 with an offset. A date-only instant starts at the first representable moment of that date in the workflow time zone.
- `between` requires exactly two values. Its start must be earlier for instants and no later for numbers or dates.
- Generated expressions follow the shared schema subset and runtime limits: 6 levels, 100 nodes, 65,536 AST units, and 65,536 UTF-8 wire bytes. Oversize or invalid Unicode values fail before the API request.
- Custom lead-field metadata is loaded once per node execution and shared across input items.

## Contact

- Phone, email, and Instagram each accept up to 10 comma-separated values. Empty entries are ignored; if all values are empty, the node makes no request.
- `Instagram Field` is used only when Instagram has a value. The selected field must be a text custom field.
- **Match: All Filled Fields** requires a match for each populated contact type. Multiple values of one type are sent together.
- If Newar reports more than 100 matches, the node errors instead of returning a possibly incomplete list. Add more specific values.
- Instagram custom-field search stops at 5,000 leads. Repeated cursors, malformed pages, invalid lead IDs, and mismatched field values produce an error instead of a partial or empty result.

## Diagnosing incomplete results

Text, Contact, and Conditions searches validate response pages and lead identifiers before returning results. A repeated cursor is treated as an incomplete API response; the node does not return accumulated pages. Empty pages with a next cursor are followed. Fix invalid filter values in the named condition; for response or cursor errors, capture the workflow execution and request Newar API support to inspect the response.

The tests use the repository's execution-context fake. The operator-options test uses the editor's nested fixed-collection shape and `&field` sibling lookup. The schema fixture at `test/fixtures/filter-expression.schema.json` is a Draft-07-compatible snapshot of the generated-expression subset of the shared v1 schema; refresh it when that shared contract changes. Shared runtime limits are tested separately because they are schema extensions, not JSON Schema keywords.

The node tests do not call the production API or launch a real n8n editor. API response behavior and the editor UI still require validation in a safe local or preview environment before release.
