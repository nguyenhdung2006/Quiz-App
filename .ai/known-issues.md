# Known Issues

## Release Gate External Evidence

Severity: High

Impact: production release remains `NOT_READY`.

Issue: production env validation and staging smoke cannot be completed from this workspace because redacted deployed-config provenance, staging URLs, and test identity metadata are not present. The existing restore file is explicitly partial: it has no real backup reference/verification and no restored-target `/api/health` smoke.

Workaround: treat the current repository as staging-candidate code, not a production release.

Next action: provide the required env/evidence and re-run `npm run gate:report` or the GitHub Production Release Gate workflow.

## Source Integrity During This Task

Severity: Medium

Impact: `source-integrity` remains expected to report a dirty tree while the three supplied audit artifacts remain intentionally untracked.

Workaround: expected for this review handoff. Do not delete, modify, ignore, hide, or accidentally stage the audit artifacts merely to clean the tree.

Next action: keep the artifacts visible and untracked; do not clean, ignore, stage, or commit them merely to satisfy the gate.

## CSP Inline Style Limitation

Severity: Medium

Impact: backend and Vercel CSPs exclude `unsafe-eval` and script `unsafe-inline`, but `style-src` still allows `unsafe-inline` for compatibility with the current dynamic-style inventory.

Workaround: keep the exact inline-style ratchet and compatible style policy while the remaining arbitrary-value writes are migrated in focused batches.

Next action: migrate the remaining allowlisted style writes, validate report-only evidence, then remove style `unsafe-inline`.

## Frontend Global Coupling

Severity: Medium

Impact: the tested AI Deck, Learning Studio storage, and UI-action seams reduce direct API, browser-storage, and coordinator-command coupling, but `app.js`, `vocab.js`, and `learning-studio.js` still depend on mutable globals and static script ordering.

Workaround: continue small facade-backed extractions with characterization tests; do not perform a framework or wholesale ES-module rewrite.

Next action: pause incremental Finding 11 work unless a separately approved, evidence-backed seam offers material coupling reduction without entering profile/account semantics, stale recovery, broad module conversion, or state architecture.

## In-Memory Rate Limiting

Severity: Medium

Impact: AI limits are process-local and reset on restart; they are not global across multiple backend instances.

Workaround: keep one backend instance and configure minute/day limits.

Next action: add Redis or another distributed limiter only if deployment becomes multi-instance or AI abuse/cost risk appears.

## API/Scale Maturity

Severity: Medium

Impact: progress and limited review queues now have bounded entity loading, but large accounts can still hit the full snapshot payload and analytics in-memory aggregation bottlenecks.

Workaround: current scale is suitable for beta/staging validation.

Next action: evaluate analytics aggregate projections and a future paginated/delta sync contract as separate architecture-gated work. Define tombstone and quiz-history retention policy before implementing any cleanup.

## Retention Policy Undefined

Severity: Medium

Impact: tombstones and quiz history grow without an approved lifecycle limit, while arbitrary deletion could break stale-device recovery or remove user history.

Workaround: retain both datasets and monitor growth; no automatic deletion is enabled.

Next action: product/data owners must define recovery guarantees, history expectations, and retention periods before a cleanup job or migration is designed.

## Render Exit 137 Operational Incident

Severity: High

Impact: a Render runtime exited with status 137 before readiness, but the current branch could not reproduce the failure under a hard 512 MiB limit. The failing log reported `root`, while the current image runs as UID/GID 10001, so the deployed runtime may differ materially from this branch.

Workaround: keep production status `NOT_READY`; do not add speculative JVM, pool, thread, or container changes.

Next action: verify the exact Render commit/image/Dockerfile/service root and obtain platform memory/OOM event evidence. Root cause remains unconfirmed and separate from Finding 10.
