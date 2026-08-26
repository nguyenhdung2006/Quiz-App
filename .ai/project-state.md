# Project State

Date: 2026-08-25

Version: `0.0.1-SNAPSHOT`.

Branch: `chore/audit-reconciliation-and-upgrade`.

Production gate: `NOT_READY`.

Current focus: Finding 12 Batch 12A server-issued online quiz-attempt foundation is implemented for review; Finding 12 remains `PARTIALLY_FIXED / LEGACY PATH STILL OPEN`.

Implemented and verified locally:

- Server-authoritative quiz results and official progress.
- Sync payload lockout for server-managed stats/mastery.
- CSRF for OAuth2 session auth with central frontend API helper.
- Sync Contract V2 with stable `wordUid`, revision conflict handling, tombstones, and legacy numeric id bridge.
- Flyway production schema policy with `application-prod.yml` and `ProductionDatabaseSafetyGuard`.
- Request correlation, MDC cleanup, Micrometer/request counters, domain counters, and configurable in-memory AI rate limiting.
- Explicit Spring Security response headers with CSP, Referrer-Policy, X-Content-Type-Options, frame deny policy, and HTTPS-gated HSTS.
- Profile/avatar hardening for backend input/output, OAuth picture ingestion, frontend cache, and image rendering.
- Production release-gate scripts and GitHub workflow.
- Static Vercel CSP/browser security headers without `unsafe-eval` or script `unsafe-inline`.
- Profile Editor and How It Works keyboard focus containment/restoration.
- Consistent `X-Sync-Revision` mutation propagation to the frontend.
- Server-authoritative Mark Known/Mark Hard actions and canonical streak-5 mastery.
- Revision-protected persistence for clearing only mastered wrong-bank entries.
- Database-side priority ordering/limiting for bounded review queues.
- Targeted progress count/aggregate queries instead of full snapshot loading.
- Snapshot vocabulary reuse, wrong-bank ID projection, and achievement N+1 removal.
- Deterministic 100/1,000/10,000-word Finding 10 benchmark and regression thresholds.
- Endpoint-specific AI Deck client facade with characterized request/error semantics.
- Account-scoped Learning Studio storage facade with characterized A/B/A isolation, offline reload, empty, and malformed-data behavior.
- Delegated UI-action registry that replaces 16 direct `app.js` action-global calls with one characterized facade.
- UUID-addressed, owned quiz attempts with captured answer context, 24-hour expiry, database locking, server scoring, and idempotent exact retry.

Last verified commands:

- Finding 12 focused hardening/schema/attempt suites: PASS, 35 tests.
- `cd backend; .\mvnw.cmd verify`: PASS, 132 tests; 89.56% line coverage (2635/2942).
- `cd backend; .\mvnw.cmd -DskipTests package`: PASS.
- Local PostgreSQL 16.14 Flyway/Hibernate gate: PASS for fresh V1-V5 migration and repeat startup/validation at schema version 5.
- Finding 10 focused regressions: PASS, 3 tests.
- Finding 10 H2 benchmark/threshold suite: PASS, 1 test across 100/1,000/10,000-word datasets.
- Finding 11C pre/post-extraction navigation/data-action characterization: PASS, 7 tests.
- Finding 11C UI-action registry helper suite: PASS, all 15 mappings, numeric challenge argument, and unknown-action no-op.
- `npx playwright test --project=chromium`: PASS, 78 tests.
- Frontend syntax: PASS, 23 files.
- ESLint: PASS; app baseline remains 135 and total baseline remains 493 because no unrelated suppressions were pruned.
- Frontend build, assets, inline-style ratchet, helper tests, docs drift, and secret scan: PASS.
- `npm run gate:secret-scan`: PASS.
- `npm run gate:source-integrity`: expected `BLOCKED` for the three intentionally untracked audit artifacts and the opt-in legacy replay proof while they remain untracked.

Remaining limitations for next Codex session:

- Production env vars are not loaded in this workspace.
- Restore rehearsal evidence is missing.
- Staging smoke URLs/test identity are missing.
- Source integrity remains dirty because the three audit artifacts and the opt-in legacy replay proof must remain untracked and visible.
- Full snapshot pagination/delta sync, analytics database aggregation, and tombstone/quiz-history retention policy remain future work.
- The Render exit-137 incident remains a separate unresolved operational issue; the current branch did not reproduce it under a hard 512 MiB limit.
- Frontend global-script risk remains partially fixed; account storage/state and broader app/vocabulary boundaries remain future bounded batches.
- Legacy `POST /api/quiz-results` remains replayable until the frontend moves to attempts in Batch 12B; review and Mark Known/Hard replay semantics remain open.
- Consumed-attempt cleanup has an approved seven-day target but is not implemented in Batch 12A.
- OpenAPI, full service split, deployed OAuth E2E, and static frontend removal of inline handlers remain future work.
