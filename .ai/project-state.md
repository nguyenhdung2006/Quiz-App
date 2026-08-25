# Project State

Date: 2026-08-25

Version: `0.0.1-SNAPSHOT`.

Branch: `chore/audit-reconciliation-and-upgrade`.

Production gate: `NOT_READY`.

Current focus: Finding 11 Batch 11A frontend API-client extraction, status `PARTIALLY_FIXED` after final review.

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

Last verified commands:

- `cd backend; .\mvnw.cmd test`: PASS, 121 tests.
- `cd backend; .\mvnw.cmd verify`: PASS, 121 tests; 88.90% line coverage (2354/2648).
- Finding 10 focused regressions: PASS, 3 tests.
- Finding 10 H2 benchmark/threshold suite: PASS, 1 test across 100/1,000/10,000-word datasets.
- Finding 11 focused API/AI Deck Playwright: PASS, 8 tests.
- `npx playwright test --project=chromium`: PASS, 73 tests.
- Frontend syntax: PASS, 21 files.
- ESLint: PASS; suppression baseline reduced from 505 to 499.
- Frontend build, assets, inline-style ratchet, helper tests, docs drift, and secret scan: PASS.
- `npm run gate:secret-scan`: PASS.
- `npm run gate:source-integrity`: expected `BLOCKED` solely for the three intentionally untracked audit artifacts after this batch is committed.

Remaining limitations for next Codex session:

- Production env vars are not loaded in this workspace.
- Restore rehearsal evidence is missing.
- Staging smoke URLs/test identity are missing.
- Source integrity remains dirty solely because the three audit artifacts must remain untracked and visible.
- Full snapshot pagination/delta sync, analytics database aggregation, and tombstone/quiz-history retention policy remain future work.
- The Render exit-137 incident remains a separate unresolved operational issue; the current branch did not reproduce it under a hard 512 MiB limit.
- Frontend global-script risk remains partially fixed; account storage/state and broader app/vocabulary boundaries remain future bounded batches.
- OpenAPI, full service split, deployed OAuth E2E, and static frontend removal of inline handlers remain future work.
