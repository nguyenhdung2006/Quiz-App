# Testing

## Historical Verified Baselines

Run on 2026-07-31 from this workspace. Task 6 did not rerun full backend or
Playwright regression, so exact test counts below must be refreshed before they
are used in release notes:

- `backend`: `.\mvnw.cmd test` passed in the historical run.
- `backend`: `.\mvnw.cmd clean package -DskipTests` passed.
- `frontend`: `npx playwright test` passed in the historical run.
- `frontend`: requested `node --check` commands for `config.js`, `app.js`, `login.js`, `ai-explain.js`, `analytics-dashboard.js`, and `review-today.js` passed.
- `npm run build:frontend` passed.
- `npm run gate:secret-scan` passed after the scanner kept the
  commit-candidate path and fixed fallback walking so ignored local `.env` files
  are not scanned when Git listing is unavailable.
- `npm run gate:report` is expected to conclude `NO-GO` until source integrity
  runs on a clean candidate, real production env validation is available,
  restore rehearsal evidence exists, and staging smoke variables are configured.

## Historical Baseline Before CSRF Change

- `backend`: `.\mvnw.cmd test` passed with 57 tests.
- `backend`: `.\mvnw.cmd clean package -DskipTests` passed.
- `frontend`: `npm run test:frontend` passed with 24 Playwright tests.
- Frontend build script is not defined in `package.json`.
- Real Google OAuth browser E2E was not run in this local audit.

## CSRF Verification

Backend CSRF behavior is covered by `backend/src/test/java/com/quizapp/CsrfSecurityTests.java`:

- `GET /api/csrf` issues token JSON and `XSRF-TOKEN` cookie.
- Missing CSRF on unsafe API calls returns `403` JSON.
- Invalid CSRF on unsafe API calls returns `403` JSON.
- Valid CSRF allows authenticated unsafe writes.
- A valid CSRF token does not authenticate anonymous unsafe requests.
- Safe GET endpoints do not require CSRF.
- OAuth2 authorization GET is not blocked by CSRF.
- Logout requires CSRF and returns `204` when valid.
- CORS preflight allows configured origins and rejects an unknown origin.

Frontend CSRF behavior is covered in `tests/smoke.spec.js`:

- GET does not add CSRF.
- POST/PUT/DELETE add `X-XSRF-TOKEN` for trusted backend URLs.
- Third-party requests do not receive CSRF headers.
- Caller headers are preserved.
- `FormData` requests are not forced to JSON content type.
- Unsafe `403` is not retried automatically.
- Clearing CSRF memory forces the next unsafe request to fetch a new token.

## Verification Commands

```powershell
cd backend
.\mvnw.cmd clean test
.\mvnw.cmd verify
.\mvnw.cmd clean package -DskipTests
```

`.\mvnw.cmd verify` runs the full backend tests, generates the JaCoCo report
under `backend/target/site/jacoco/`, and enforces the current bundle line
coverage threshold of 80%.

Production database safety guard:

```powershell
cd backend
.\mvnw.cmd -Dtest=ProductionDatabaseSafetyGuardTests test
```

This test verifies:

- `application-prod.yml` pins Hibernate to `validate`.
- Production Flyway is enabled and validates migrations.
- Flyway clean is disabled.
- Production app startup rejects `baseline-on-migrate=true`.
- Unsafe effective overrides fail when `prod` is active.
- Migration files are ordered, contiguous, versioned, and do not contain tombstone work.

```powershell
npm run check:frontend
npm run lint
npm run test:frontend
npm run test:docs-drift
npm run coverage:backend
```

`npm run check:frontend` performs recursive `node --check` on all
`frontend/js/*.js` files. `npm run lint` runs ESLint over `frontend/js`,
`tests`, `scripts`, and `playwright.config.js` with
`eslint-suppressions.json` as the current legacy baseline. New lint violations
outside that baseline fail the command.
# Sync V2 Verification

Backend:

- `.\mvnw.cmd test` covers Sync V2 through `SyncContractV2Tests`.
- Covered invariants: required contract version, required `wordUid`, stable UID rename, tombstone precedence, idempotent repeated deletion, direct delete tombstone creation with `legacyWordId`, delete-by-UID without live row, legacy-ID user scoping, atomic duplicate-English rollback, user isolation, existing CSRF/auth regressions, and forged sync payload rejection for server-managed progress.

Frontend:

- Run `node --check` against changed files: `frontend/js/app.js`, `frontend/js/vocab.js`, `frontend/js/main.js`, `frontend/js/quiz.js`, `frontend/js/review-today.js`.
- Run `npm run test:frontend` for Playwright smoke coverage, including the legacy-device anti-resurrection case where a local word only has numeric `id` and the server snapshot only returns a tombstone.

PostgreSQL:

- CI starts PostgreSQL 16 and runs `SPRING_PROFILES_ACTIVE=prod ./mvnw -B -Dtest=QuizApplicationTests test` with Flyway enabled and Hibernate `ddl-auto=validate`.
- This verifies ordered V1 -> V4 migrations against PostgreSQL in CI. The latest migration at this commit is `V4__add_legacy_word_id_to_word_tombstones.sql`. It does not execute a production or staging migration.

Docs drift:

- `npm run test:docs-drift` checks that `docs/API.md` covers current controller routes and public route classifications, that canonical docs mention the latest Flyway migration, that backend env keys are documented, and that known product/backend docs contradictions do not reappear.

## Production Release Gate

The `Production Release Gate` workflow runs from `.github/workflows/production-release-gate.yml` by `workflow_dispatch` or `workflow_call`. It does not deploy.

Gate controls include:

- full backend test suite plus JaCoCo line coverage threshold through
  `.\mvnw.cmd verify`;
- focused security regression tests: `BackendHardeningTests` and `CsrfSecurityTests`;
- observability and rate-limit controls: `ObservabilityAndRateLimitTests` and `AiRateLimitTests`;
- frontend ESLint validation through `npm run lint`;
- frontend static build validation through `npm run build:frontend`;
- Playwright smoke tests with report artifacts;
- Flyway rehearsal against temporary PostgreSQL with `SPRING_PROFILES_ACTIVE=prod`;
- targeted two-device sync controls using `SyncContractV2Tests` and frontend sync smoke tests;
- redacted production environment validation;
- secret scan;
- backup/rollback readiness checks;
- staging smoke only when staging variables are configured.

The gate report marks staging/OAuth/restore evidence as `BLOCKED` or `NOT_RUN` unless actually configured and executed.

## Current 2026-08-08 Verification Gaps

These are not pass/fail claims until commands are actually run for the current
commit:

- Backend Maven tests must pass in an environment with Maven/dependency access.
- Frontend build must pass through the available npm scripts.
- Playwright must pass in an environment with browser binaries installed.
- GitHub Actions status must be checked for the pushed commit.
- Production secret scan must be re-run cleanly to verify the empty-env-key false
  positive reported in the 2026-08-08 audit is no longer blocking.

## Observability And Rate-Limit Verification

Backend:

```powershell
cd backend
.\mvnw.cmd -Dtest=ObservabilityAndRateLimitTests,AiRateLimitTests test
```

This verifies:

- generated and client-supplied `X-Request-ID` behavior;
- unsafe request IDs are replaced;
- MDC contains `requestId` during a request and is cleared afterward;
- `/actuator/metrics` is exposed and includes application metrics;
- 4xx and 5xx request metrics are recorded;
- sync conflict, quiz failure, AI failure, and rate-limit hit counters increment;
- AI in-memory rate limit returns `429`, isolates users through existing tests, and resets after the configured test window.
