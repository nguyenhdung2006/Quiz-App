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
| Backend full test | Maven Surefire reports |
| Security regression tests | focused backend hardening and CSRF tests |
| Frontend static build | JavaScript syntax and static asset references |
| Frontend Playwright smoke | Playwright report and test results |
| Flyway rehearsal | temporary PostgreSQL migration and repeat validation logs |
| Two-device sync | backend SyncContract V2 tests and targeted frontend sync smoke tests |
| Production environment validation | redacted variable presence and configuration safety |
| Backup/rollback readiness | concrete docs and rehearsal evidence |
| Staging smoke | real staging health/CSRF/frontend checks when staging variables exist |

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

## Required GitHub Secrets For Staging Smoke

These names are required for staging smoke. Do not store production user secrets in them.

- `STAGING_BACKEND_URL`
- `STAGING_FRONTEND_URL`
- `STAGING_TEST_USER_HINT`

If they are absent, the staging control is `BLOCKED` and the final conclusion is `NO-GO`.

## Required Restore Rehearsal Evidence

Backup/rollback readiness is `BLOCKED` until one of these exists:

- `docs/restore-rehearsal-evidence.md`, containing non-production restore rehearsal evidence; or
- CI env `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`, used only when the release record links to equivalent external evidence.

The evidence must not include raw data or secret values.

## Local Commands

Useful local checks:

```powershell
npm run gate:source-integrity
npm run gate:secret-scan
npm run gate:validate-env
npm run build:frontend
npm run test:frontend
cd backend
.\mvnw.cmd test
```

Local `.env` files are intentionally ignored by Git. The secret scan fails if a real `.env`, private key, OAuth secret, token, or password-like value is committed.

## Current Limitations

The gate does not deploy and does not mutate production. Staging OAuth browser flow and production backup restore can only be marked `PASS` when real, non-production rehearsal evidence is available.
