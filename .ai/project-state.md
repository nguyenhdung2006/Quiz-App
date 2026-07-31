# Project State

Date: 2026-07-31

Version: `0.0.1-SNAPSHOT`.

Branch: `main`.

Production gate: `NOT_READY`.

Current focus: audit reconciliation and production hardening evidence.

Implemented and verified locally:

- Server-authoritative quiz results and official progress.
- Sync payload lockout for server-managed stats/mastery.
- CSRF for OAuth2 session auth with central frontend API helper.
- Sync Contract V2 with stable `wordUid`, revision conflict handling, tombstones, and legacy numeric id bridge.
- Flyway production schema policy with `application-prod.yml` and `ProductionDatabaseSafetyGuard`.
- Request correlation, MDC cleanup, Micrometer/request counters, domain counters, and configurable in-memory AI rate limiting.
- Production release-gate scripts and GitHub workflow.

Last verified commands:

- `backend\.mvnw.cmd test`: PASS, 91 tests.
- `backend\.mvnw.cmd clean package -DskipTests`: PASS.
- `npx playwright test`: PASS, 28 tests.
- `npm run gate:secret-scan`: PASS.
- `npm run gate:report`: NO-GO.

Remaining limitations for next Codex session:

- Production env vars are not loaded in this workspace.
- Restore rehearsal evidence is missing.
- Staging smoke URLs/test identity are missing.
- Source integrity is dirty until current changes are committed by a human-approved workflow.
- OpenAPI, pagination/query optimization, full service split, deployed OAuth E2E, and explicit CSP/HSTS tests remain future work.
