# Production Release Gate

This gate is a pre-production control, not a deployment workflow. It is designed to be repeatable, fail-closed, and evidence-producing for backend, frontend, security, Flyway, sync, environment, staging, backup, and rollback readiness.

## How To Run

In GitHub Actions, run:

1. Open **Actions**.
2. Select **Production Release Gate**.
3. Choose **Run workflow** on the exact branch/commit being considered.

The workflow can also be reused with `workflow_call` by a future release workflow. A production deployment workflow must depend on a `GO` report for the same commit SHA.

## Controls

The gate runs these controls:

| Control | Evidence |
| --- | --- |
| Source integrity | commit SHA, branch, Flyway version uniqueness, production config safety |
| Secret scan | committed file names and content patterns for secrets |
| Backend full test and coverage | Maven Surefire reports plus JaCoCo report/check |
| Security regression tests | focused backend hardening and CSRF tests |
| Observability/rate-limit controls | request ID, metrics endpoint, 4xx/5xx, sync/quiz/AI/rate-limit counters |
| Frontend lint | ESLint result with the current suppressions baseline |
| Frontend CSS asset ownership | CSS files linked/imported by the runtime stylesheet graph |
| Frontend static build | JavaScript syntax and static asset references |
| Frontend Playwright smoke | Playwright report and test results |
| Flyway rehearsal | temporary PostgreSQL migration and repeat validation logs |
| Two-device sync | backend SyncContract V2 tests and targeted frontend sync smoke tests |
| Production env validator self-test | safe and unsafe fixtures that test validator logic only |
| Production environment validation | redacted deployed environment presence, deployment evidence, and configuration safety |
| Backup/rollback readiness | concrete docs and rehearsal evidence |
| Staging smoke | real staging health/CSRF/frontend checks plus authenticated OAuth/session, CRUD, sync, delete/tombstone, and logout evidence |

## Acceptance Record

The main artifact is named `production-release-gate-report`. It contains:

- `production-release-gate-report.md`
- `production-release-gate-report.json`
- `controls/*.json`
- backend Surefire reports
- Flyway rehearsal logs
- secret scan report
- frontend static build report

Status meanings:

- `PASS`: the control ran and met its acceptance criteria.
- `FAIL`: the control ran and found an unsafe condition.
- `BLOCKED`: required external evidence is missing, for example staging URL, test identity, or restore rehearsal.
- `NOT_RUN`: no status artifact was produced, usually because an earlier mandatory control failed.

Final conclusion:

- `GO`: every mandatory control is `PASS`.
- `NO-GO`: at least one control is `FAIL`, `BLOCKED`, or `NOT_RUN`.

Manual approval does not convert `FAIL`, `BLOCKED`, or `NOT_RUN` into `PASS`.

## Observability And Rate-Limit Controls

The gate validates that production keeps minimum operational visibility:

- health, info, and metrics endpoints remain exposed;
- production root logging is not `DEBUG`, `TRACE`, or `ALL`;
- request logs include a correlation `requestId`;
- AI rate limits are configured with positive bounded values;
- `RATE_LIMIT_MODE` remains `in-memory` until a distributed limiter is implemented.

The gate must not require Redis for the current single-instance deployment. If future code implements Redis/distributed rate limiting, add a new control that requires Redis configuration only when that distributed mode is explicitly selected.

## Required GitHub Secrets For Staging Smoke

These names are required for staging smoke. Do not store production user secrets in them.

- `STAGING_BACKEND_URL`
- `STAGING_FRONTEND_URL`
- `STAGING_TEST_USER_HINT`
- `STAGING_AUTH_SMOKE_EVIDENCE_FILE` (optional path override; defaults to
  `docs/staging-auth-smoke-evidence.md`)

If the required URLs/test identity are absent, the staging control is `BLOCKED`
and the final conclusion is `NO-GO`.

The script checks backend `/api/health`, backend `/api/csrf`, and the frontend
root directly. That basic unauthenticated smoke is not enough for `PASS` by
itself. The control also requires a machine-readable Markdown table, following
`docs/staging-auth-smoke-checklist.md`, that records real authenticated staging
evidence for OAuth/login or equivalent session auth, CSRF, vocabulary CRUD,
sync, delete/tombstone behavior, logout/session cleanup, RTO/RPO notes, exact
commit, environment, operator, and timestamp. Missing, partial, placeholder,
or `NOT RUN` authenticated evidence keeps the control `BLOCKED`.

## Required Production Environment Evidence

The safe fixture in `.github/workflows/production-release-gate.yml` is a
validator self-test only. It must write `production-env-validator-self-test`, not
`production-env-validation`.

`production-env-validation` is `BLOCKED` unless the workflow receives real
deployment/environment evidence for the candidate:

- `RELEASE_ENV_SOURCE`: one of `deployed`, `render`, `signed-manifest`, or
  `manual-attestation`.
- `RELEASE_DEPLOYMENT_ID`: a deployment or signed manifest identifier, not a
  placeholder.
- `RELEASE_ENV_CAPTURED_AT`: ISO-8601 timestamp for when the redacted
  environment assertions were captured.

The production runtime variables are validated through redacted presence and
safety assertions. Missing values are `BLOCKED`; unsafe values such as localhost
URLs, wildcard CORS, weak/default secrets, disabled Flyway, mutating
`ddl-auto`, or fixture-like values are `FAIL`. Secret values must never be
printed in artifacts.

## Required Restore Rehearsal Evidence

Backup/rollback readiness is `BLOCKED` until one of these exists:

- `docs/restore-rehearsal-evidence.md`, containing non-production restore rehearsal evidence; or
- CI env `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`, used only when the release record links to equivalent external evidence.

The evidence must not include raw data or secret values. A complete `PASS`
requires a real backup/dump reference, backup verification, restore into
non-production, Flyway/app validation against the restored target, and restored
`/api/health` smoke. Schema-only Flyway rehearsal without a backup artifact or
health smoke remains `BLOCKED`.

## Local Commands

Useful local checks:

```powershell
npm run gate:source-integrity
npm run gate:secret-scan
npm run gate:validate-env
npm run test:gate:validate-env
npm run test:gate:report
npm run lint
npm run test:assets
npm run coverage:backend
npm run build:frontend
npm run test:frontend
cd backend
.\mvnw.cmd verify
```

Local `.env` files are intentionally ignored by Git. The secret scan fails if a real `.env`, private key, OAuth secret, token, or password-like value is committed.

## Current Limitations

The gate does not deploy and does not mutate production. Staging OAuth browser flow and production backup restore can only be marked `PASS` when real, non-production rehearsal evidence is available. Alert platform configuration is documented only until the operator connects Render/Grafana/Prometheus or another alert backend.

## 2026-08-08 Verification Notes

- The gate must be re-run on a clean release candidate before claiming GO.
- Task 2 local `npm run gate:secret-scan` is verified PASS after a narrow
  fallback fix. The root cause was Node failing to spawn Git in this workspace
  (`spawnSync git EPERM`), which made the fallback filesystem walk scan ignored
  local `.env` files. The preferred scan path remains
  `git ls-files --cached --others --exclude-standard`, and tracked source is
  still scanned when Git listing is available.
- Secret scan local PASS does not make the release gate GO. The GitHub
  Production Release Gate for the exact release candidate is still the
  authority.
- Task 7b local `npm run gate:source-integrity` is verified PASS on clean PR
  HEAD `5c74f6e08716c9761ee6b6042963b8ad7214d9e7` when run outside the sandbox.
  The sandboxed local run may return BLOCKED if Node cannot spawn Git; this is
  intentional and must not be converted into PASS without a real Git-backed run.
- Wave 2 manual `npm run gate:staging-smoke` is reported PASS with configured
  staging URLs and a non-secret test user hint. This script checks backend
  health, backend CSRF JSON/cookie, and frontend root only; Google OAuth full
  browser login/callback and staging database isolation remain separate manual
  verification items.
- Wave 3 created `docs/restore-rehearsal-evidence.md` after a real
  schema/Flyway/app-start rehearsal on a disposable non-production PostgreSQL
  target. This is not evidence that a production or sanitized backup dump was
  restored, and it does not include a restored `/api/health` smoke.
- Render screenshots confirmed one memory-limit event on August 7, 2026 at
  11:18 PM and recovery at 11:23 PM. Quantitative application memory/CPU metrics
  remain unavailable on the current Free instance, and alert notification
  delivery is not verified. The gate should not infer monitoring readiness from
  source or event screenshots alone.
- Backend test pass, frontend build pass, Playwright pass, staging smoke,
  deployed production env validation, and restore rehearsal must all be real
  results for the same commit SHA, not assumed from docs or stale artifacts.
