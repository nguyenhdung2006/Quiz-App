# Known Issues

## Release Gate External Evidence

Severity: High

Impact: production release remains `NOT_READY`.

Issue: production env validation, staging smoke, and restore rehearsal evidence cannot be completed from this workspace because secrets, staging URLs, test identity metadata, and non-production restore proof are not present.

Workaround: treat the current repository as staging-candidate code, not a production release.

Next action: provide the required env/evidence and re-run `npm run gate:report` or the GitHub Production Release Gate workflow.

## Source Integrity During This Task

Severity: Medium

Impact: `source-integrity` is blocked while findings 5-9 remain uncommitted for review and the three supplied audit artifacts remain intentionally untracked.

Workaround: expected for this review handoff. Do not delete, modify, ignore, hide, or accidentally stage the audit artifacts merely to clean the tree.

Next action: review the bounded diff, then commit only through a separately approved workflow and rerun the gate from that release candidate.

## CSP Inline Style Limitation

Severity: Medium

Impact: backend and Vercel CSPs exclude `unsafe-eval` and script `unsafe-inline`, but `style-src` still allows `unsafe-inline` for compatibility with the current dynamic-style inventory.

Workaround: keep the exact inline-style ratchet and compatible style policy while the remaining arbitrary-value writes are migrated in focused batches.

Next action: migrate the remaining allowlisted style writes, validate report-only evidence, then remove style `unsafe-inline`.

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
