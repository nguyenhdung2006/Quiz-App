# Project State

Date: 2026-08-28

Version: `0.0.1-SNAPSHOT`.

Branch: `chore/audit-reconciliation-and-upgrade`.

Production gate: `NOT_READY`.

Current focus: Finding 12 Batch 12B is implemented and locally verified, uncommitted and awaiting review; supported online quizzes use attempts and the legacy reward route is retired. Finding 12 remains `PARTIALLY_FIXED` for Review Today, Mark Known/Hard retry semantics, and retention cleanup.

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
- Browser attempt facade with in-memory exact retry, authoritative online outcomes, honest local-only fallback, and zero frontend legacy-route calls.
- Deterministic non-mutating `410 Gone` retirement of `POST /api/quiz-results`.

Last verified commands:

- Finding 12 focused attempt/schema/hardening/reward/analytics/observability/capacity suites: PASS, 53 tests (11 attempt tests, including both concurrency cases).
- `cd backend; .\mvnw.cmd clean verify`: PASS, 134 tests in 26 suites; 0 failures/errors/skips. Clean JaCoCo line coverage 88.33% (2604/2948), branch coverage 61.95% (723/1167); 80% line gate passed.
- `cd backend; .\mvnw.cmd -DskipTests package`: PASS.
- Local PostgreSQL 16.14 Flyway/Hibernate gate (2026-08-27): PASS for fresh V1-V6 migration and repeat startup/validation at schema version 6, 1 test per startup. All 6 history rows succeeded; V6 checksum -1273792706. Rehearsal JVM used UTC after local Asia/Saigon alias rejection before connection; only the disposable local container was used and removed.
- Focused quiz/attempt/failure/retry/race Chromium tests: PASS, 11 tests; late-response tests rerun after lint-only qualification change: PASS, 2 tests.
- `npm run test:frontend`: PASS, 86 Chromium tests.
- Frontend syntax: PASS, 24 files. ESLint: PASS without adding suppressions.
- Frontend static build: PASS. CSS asset guard: PASS, 10 files. Inline-style guard: PASS, 27 allowlisted usages across 9 files.
- All 7 frontend helper suites: PASS, including the new attempt-client suite.
- Docs drift: PASS, 31 controller routes, 32 environment keys, latest migration V6.
- `npm run gate:secret-scan`: PASS.
- `git diff --check`: PASS. No files staged; no commit/push/deployment performed.
- Source-integrity release gate is not a completion claim: Batch 12B is intentionally uncommitted and three audit artifacts remain untouched/untracked. Temporary replay proof was removed after its useful evidence was incorporated into permanent passing tests.

Remaining limitations for next Codex session:

- Production env vars are not loaded in this workspace.
- Restore rehearsal evidence is missing.
- Staging smoke URLs/test identity are missing.
- Source integrity remains dirty because Batch 12B awaits review/commit and the three audit artifacts must remain untracked and visible.
- Full snapshot pagination/delta sync, analytics database aggregation, and tombstone/quiz-history retention policy remain future work.
- The Render exit-137 incident remains a separate unresolved operational issue; the current branch did not reproduce it under a hard 512 MiB limit.
- Frontend global-script risk remains partially fixed; account storage/state and broader app/vocabulary boundaries remain future bounded batches.
- Old frontend/new backend version skew fails legacy cloud submission closed; deploy backend before the new frontend. New frontend/old backend remains local-only without legacy fallback.
- Review Today and Mark Known/Hard replay semantics remain open.
- Consumed-attempt cleanup has an approved seven-day target but is not implemented in Batch 12B.
- Attempt retry state is memory-only; Home/reset, a new quiz, logout, or full reload discards retry delivery state without undoing an already accepted server result.
- OpenAPI, full service split, deployed OAuth E2E, and static frontend removal of inline handlers remain future work.
