# Project State

Date: 2026-08-24

Version: `0.0.1-SNAPSHOT`.

Branch: `chore/audit-reconciliation-and-upgrade`.

Production gate: `NOT_READY`.

Current focus: bounded audit findings 5-9 remediation, pending human review.

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

Last verified commands:

- `cd backend; .\mvnw.cmd test`: PASS, 118 tests.
- `cd backend; .\mvnw.cmd verify`: PASS, 118 tests; 88.76% line coverage (2329/2624).
- `npx playwright test --project=chromium`: PASS, 72 tests.
- Frontend syntax, lint, build, assets, helper tests, docs drift, and secret scan: PASS.
- `npm run gate:secret-scan`: PASS.
- `npm run gate:source-integrity`: BLOCKED as expected for the uncommitted review batch and intentional untracked audit artifacts.

Remaining limitations for next Codex session:

- Production env vars are not loaded in this workspace.
- Restore rehearsal evidence is missing.
- Staging smoke URLs/test identity are missing.
- Source integrity is dirty until findings 5-9 are reviewed and committed by a separately approved workflow; the three audit artifacts must remain untracked and visible.
- OpenAPI, pagination/query optimization, full service split, deployed OAuth E2E, and static frontend removal of inline handlers remain future work.
