# Known Issues

## Release Gate External Evidence

Severity: High

Impact: production release remains `NOT_READY`.

Issue: production env validation, staging smoke, and restore rehearsal evidence cannot be completed from this workspace because secrets, staging URLs, test identity metadata, and non-production restore proof are not present.

Workaround: treat the current repository as staging-candidate code, not a production release.

Next action: provide the required env/evidence and re-run `npm run gate:report` or the GitHub Production Release Gate workflow.

## Source Integrity During This Task

Severity: Medium

Impact: `source-integrity` gate fails while this task's changes are uncommitted.

Workaround: expected during local SEC-01 implementation work until the approved batch is committed.

Next action: review changes, then run the gate from a clean release candidate.

## CSP Inline Handler Limitation

Severity: Medium

Impact: the backend now emits a CSP without `unsafe-eval`, but `script-src` and `style-src` still allow `unsafe-inline` for compatibility with the current static frontend.

Workaround: keep the compatible CSP while the app still uses inline event handlers and direct static script loading.

Next action: remove inline handlers in a dedicated frontend cleanup batch, then tighten CSP with nonces/hashes or external-only scripts.

## In-Memory Rate Limiting

Severity: Medium

Impact: AI limits are process-local and reset on restart; they are not global across multiple backend instances.

Workaround: keep one backend instance and configure minute/day limits.

Next action: add Redis or another distributed limiter only if deployment becomes multi-instance or AI abuse/cost risk appears.

## API/Scale Maturity

Severity: Medium

Impact: large accounts can still hit full snapshot and in-memory aggregation bottlenecks.

Workaround: current scale is suitable for beta/staging validation.

Next action: add measured repository queries, pagination/delta sync, and OpenAPI contract coverage.
