# Phase 1 Quality Evidence

Date: 2026-08-08

Branch: `chore/audit-reconciliation-and-upgrade`

Repository: `nguyenhdung2006/Quiz-App`

Audited HEAD: `adc2b0bb825dbd6397bdba3ea67656d2b676f7d4`

This document records verified evidence for the Phase 1 quality tasks from
`docs/quality-upgrade-plan-8.0.md`. The original task evidence below is tied to
the audited HEAD above unless a later section explicitly names a newer commit.

## Task 1: GitHub Actions Status

Status: PARTIAL

Verified:

- Combined commit status includes `Vercel`: `success`.
- GitHub Actions workflow run `CI` completed with conclusion `success`.
- CI run URL: `https://github.com/nguyenhdung2006/Quiz-App/actions/runs/31262520384`
- CI run number: `34`
- CI event: `pull_request`
- CI job `Backend tests and frontend checks` completed with conclusion `success`.
- Verified CI job steps include:
  - `Run backend tests`: `success`
  - `Run production database safety guards`: `success`
  - `Run PostgreSQL Flyway migration and Hibernate validate`: `success`
  - `Check frontend JavaScript syntax`: `success`
  - `Run frontend smoke tests`: `success`

Needs verification:

- `Production Release Gate` was not found as a verified completed run for HEAD
  `adc2b0bb825dbd6397bdba3ea67656d2b676f7d4` during this check.
- The release gate must not be marked PASS until a `Production Release Gate`
  run for the exact candidate SHA is observed and its artifact/result is
  reviewed.

Commands and tools used:

- `git rev-parse HEAD`
- `git remote -v`
- `Get-ChildItem .github\workflows`
- `rg "GitHub Actions|Production Release Gate|release gate|checks|status|98120bd2|current commit|NEEDS VERIFICATION" docs .github\workflows`
- GitHub connector: commit combined status for `adc2b0bb825dbd6397bdba3ea67656d2b676f7d4`
- GitHub connector: workflow runs for `adc2b0bb825dbd6397bdba3ea67656d2b676f7d4`
- GitHub connector: jobs for workflow run `31262520384`
- `curl.exe -L --silent --max-time 20 "https://api.github.com/repos/nguyenhdung2006/Quiz-App/actions/runs?head_sha=adc2b0bb825dbd6397bdba3ea67656d2b676f7d4&per_page=50"`

## Task 2: Secret Scan Gate

Status: PASS

Initial blocked result:

- `npm run gate:secret-scan` initially returned exit code `1`.
- The generated control report `release-gate-artifacts/controls/secret-scan.json`
  had `status: FAIL` and `findingCount: 4`.
- The findings were for ignored local files: `.env` and `backend/.env`.

Root cause:

- The secret scan script is designed to scan `git ls-files --cached --others
  --exclude-standard`, which keeps the scan focused on tracked and untracked
  commit-candidate files.
- In this local environment, Node could not spawn Git (`spawnSync git EPERM`), so
  the script fell back to filesystem walking.
- The fallback walker did not apply the repo's local-secret ignore rules, so it
  scanned ignored local `.env` files.

Fix applied:

- `scripts/production-release-gate/secret-scan.mjs` now keeps the Git candidate
  scan path as the preferred path.
- Only when Git candidate listing is unavailable, fallback walking skips local
  secret files that are intentionally ignored by `.gitignore`, including `.env`,
  `.env.*`, `client_secret_*.json`, `backend/config/oauth2-google.yml`, and
  `backend/src/main/resources/application-local.yml`.
- This does not weaken scanning for tracked source when Git is available: tracked
  and untracked commit-candidate files are still scanned through
  `git ls-files --cached --others --exclude-standard`.

Verified after fix:

- `npm run gate:secret-scan`: PASS
- `release-gate-artifacts/controls/secret-scan.json`: `status: PASS`,
  `findingCount: 0`
- `git check-ignore -v .env backend/.env` confirms both `.env` and
  `backend/.env` are ignored by `.gitignore`.
- `git ls-files --cached --others --exclude-standard .env backend/.env` returned
  no paths, so these files are not commit candidates in this checkout.
- No `.env` content was printed, edited, staged, or committed.

Commands used:

- `Get-Content package.json`
- `rg "gate:secret-scan|secret-scan|secret" package.json scripts docs .github\workflows`
- `npm run gate:secret-scan`
- `Get-ChildItem -Recurse release-gate-artifacts`
- `Get-Content release-gate-artifacts\controls\secret-scan.json`
- `git status --short --ignored`
- `Get-Content scripts\production-release-gate\secret-scan.mjs`
- `Get-Content scripts\production-release-gate\lib.mjs`
- `node -e "...execFileSync('git', ['ls-files', ...])..."`
- `where.exe git`
- `git check-ignore -v .env backend/.env`
- `git ls-files --cached --others --exclude-standard .env backend/.env`
- `git status --short`
- `git diff --stat`
- `git diff --check`

## Task 3: Source Integrity and Release Gate Scripts

Status: PASS/BLOCKED MIXED, no runtime code changes

Package scripts confirmed:

- `build:frontend`: `node scripts/production-release-gate/frontend-static-build.mjs`
- `gate:source-integrity`: `node scripts/production-release-gate/source-integrity.mjs`
- `gate:secret-scan`: `node scripts/production-release-gate/secret-scan.mjs`
- `gate:validate-env`: `node scripts/production-release-gate/validate-production-env.mjs`
- `gate:backup-rollback`: `node scripts/production-release-gate/backup-rollback-readiness.mjs`
- `gate:staging-smoke`: `node scripts/production-release-gate/staging-smoke.mjs`
- `gate:report`: `node scripts/production-release-gate/generate-report.mjs`

Safe local gate results:

- `npm run gate:secret-scan`: PASS.
- `npm run build:frontend`: PASS.
- `npm run gate:validate-env -- --control=production-env-validation` with the
  safe fixture values from `.github/workflows/production-release-gate.yml`: PASS,
  `findingCount: 0`.
- `npm run gate:validate-env -- --control=production-env-invalid-fixture
  --expect-invalid` with the intentionally unsafe fixture from the workflow:
  PASS because invalid values were rejected as expected.

Blocked or needs verification:

- `npm run gate:backup-rollback`: BLOCKED by the gate script because concrete
  restore rehearsal evidence is missing:
  `docs/restore-rehearsal-evidence.md` or
  `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`.
- `npm run gate:staging-smoke`: BLOCKED by the gate script because
  `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and
  `STAGING_TEST_USER_HINT` are not configured in this local environment.
- `npm run gate:source-integrity`: NEEDS VERIFICATION on a clean release
  candidate. The script intentionally fails when `git status --porcelain` is
  dirty, and this checkout currently has approved in-progress docs/script
  evidence changes.
- `npm run gate:report`: not run in this task because it intentionally returns
  NO-GO when mandatory controls are missing, blocked, or not run.

Commands used:

- `rg -n "gate:|build:frontend|test:frontend|test:backend|smoke" package.json`
- `rg -n "npm run|gate:|Production Release Gate|source-integrity|secret-scan|staging-smoke|backup|validate" .github\workflows scripts\production-release-gate package.json`
- `Get-ChildItem scripts\production-release-gate`
- `Get-Content scripts\production-release-gate\source-integrity.mjs`
- `Get-Content scripts\production-release-gate\validate-production-env.mjs`
- `Get-Content scripts\production-release-gate\staging-smoke.mjs`
- `Get-Content scripts\production-release-gate\backup-rollback-readiness.mjs`
- `Get-Content scripts\production-release-gate\frontend-static-build.mjs`
- `Get-Content scripts\production-release-gate\generate-report.mjs`
- `Get-Content .github\workflows\production-release-gate.yml`
- `npm run gate:secret-scan`
- `npm run build:frontend`
- `npm run gate:backup-rollback`
- `npm run gate:staging-smoke`
- `npm run gate:validate-env -- --control=production-env-validation`
- `npm run gate:validate-env -- --control=production-env-invalid-fixture --expect-invalid`
- `Get-ChildItem release-gate-artifacts\controls`
- `Get-Content release-gate-artifacts\controls\backup-rollback-readiness.json`
- `Get-Content release-gate-artifacts\controls\staging-smoke.json`
- `Get-Content release-gate-artifacts\controls\production-env-validation.json`
- `Get-Content release-gate-artifacts\controls\production-env-invalid-fixture.json`

## Task 4: Staging Smoke Verification

Status: BLOCKED

Script reviewed:

- `scripts/production-release-gate/staging-smoke.mjs`
- `.github/workflows/production-release-gate.yml`

Required environment:

- `STAGING_BACKEND_URL`
- `STAGING_FRONTEND_URL`
- `STAGING_TEST_USER_HINT`

Current local environment status:

- `STAGING_BACKEND_URL`: MISSING
- `STAGING_FRONTEND_URL`: MISSING
- `STAGING_TEST_USER_HINT`: MISSING

Command run:

- `npm run gate:staging-smoke`: BLOCKED

The generated control status is BLOCKED because the script requires configured
staging URLs and non-secret test identity metadata. No staging URL, user hint,
secret, or production credential was hardcoded.

Safe command template, with placeholders to replace locally or in GitHub
Secrets:

```powershell
$env:STAGING_BACKEND_URL="<staging backend https url>"
$env:STAGING_FRONTEND_URL="<staging frontend https url>"
$env:STAGING_TEST_USER_HINT="<non-secret staging test user hint>"
npm run gate:staging-smoke
```

Conditions required to move from BLOCKED to PASS:

- All three env vars are present and non-empty.
- `STAGING_BACKEND_URL` and `STAGING_FRONTEND_URL` use HTTPS and are not
  localhost, `127.0.0.1`, placeholder, or `example.com`.
- `GET /api/health` on the staging backend returns a 2xx response.
- `GET /api/csrf` on the staging backend returns a 2xx JSON response and issues
  a cookie.
- The staging frontend root returns a 2xx or 3xx response.
- The script reports `[PASS] staging-smoke`.
- OAuth browser callback evidence remains separate; this script explicitly does
  not mark OAuth browser login/logout PASS.

Commands used:

- `Get-Content scripts\production-release-gate\staging-smoke.mjs`
- `rg -n "STAGING_BACKEND_URL|STAGING_FRONTEND_URL|STAGING_TEST_USER_HINT|staging-smoke|Task 4|Staging smoke" docs\phase-1-quality-evidence.md docs\quality-upgrade-plan-8.0.md .github\workflows scripts\production-release-gate package.json`
- Environment presence check for `STAGING_BACKEND_URL`,
  `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`
- `npm run gate:staging-smoke`

## Task 5: Backup/Restore Rehearsal Evidence

Status: PARTIAL PASS / NEEDS BACKUP-DUMP VERIFICATION

Script reviewed:

- `scripts/production-release-gate/backup-rollback-readiness.mjs`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_RELEASE_GATE.md`
- `docs/ROADMAP.md`
- `docs/TROUBLESHOOTING.md`

Gate requirements:

- Required docs must exist:
  `docs/DEPLOYMENT.md`, `docs/PRODUCTION_RELEASE_GATE.md`,
  `docs/flyway-baseline-rehearsal.md`, and `docs/deploy.md`.
- Required terms must be present across those docs: `backup`,
  `restore rehearsal`, `rollback app`, `forward-fix`, `owner`, and
  `rollback trigger`.
- Concrete restore rehearsal evidence must exist through one of:
  `docs/restore-rehearsal-evidence.md`, or
  `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`.

Current status:

- Required docs: present.
- Required terms: present.
- `docs/restore-rehearsal-evidence.md`: present after Wave 3 schema/Flyway/app-start rehearsal.
- `RELEASE_RESTORE_REHEARSAL_EVIDENCE`: MISSING.
- `npm run gate:backup-rollback`: PASS after the evidence file was created.

Safe docs added:

- `docs/restore-rehearsal-checklist.md` was added as a preparation checklist.
  It is not completed evidence and must not be treated as proof of restore
  success.

Wave 3 rehearsal performed:

- Target: disposable Docker PostgreSQL on `localhost:5433`, database
  `quiz_app_restore_rehearsal`.
- Command: backend Maven context test with `SPRING_PROFILES_ACTIVE=prod`,
  `FLYWAY_ENABLED=true`, `JPA_DDL_AUTO=validate`, and process-scoped database
  env values.
- Result: PASS for schema/Flyway/app-start rehearsal. Flyway validated and
  applied 4 migrations on PostgreSQL 16.14, Hibernate validate passed, and
  `QuizApplicationTests.contextLoads` completed successfully.
- Evidence file: `docs/restore-rehearsal-evidence.md`.

Remaining limitations:

- The project has docs for provider backup/export or `pg_dump`, but no
  repository script that performs a real backup/dump restore.
- No sanitized backup/dump artifact was provided, so backup artifact restore is
  still not verified.
- `/api/health` was not smoked against a launched restored app server.
- No production Supabase database was touched.
- This should not be treated as full production backup/restore readiness.

Safe command template:

```powershell
# After real non-production restore rehearsal evidence exists:
npm run gate:backup-rollback

# Alternative only when equivalent external evidence is linked:
$env:RELEASE_RESTORE_REHEARSAL_EVIDENCE="true"
npm run gate:backup-rollback
```

Commands used:

- `Get-Content scripts\production-release-gate\backup-rollback-readiness.mjs`
- `Get-Content scripts\production-release-gate\lib.mjs`
- `rg -n "backup|restore rehearsal|rollback|forward-fix|rollback trigger|restore-rehearsal|RELEASE_RESTORE_REHEARSAL_EVIDENCE|gate:backup-rollback" docs scripts package.json .github\workflows`
- Existence/presence check for `docs/restore-rehearsal-evidence.md` and
  `RELEASE_RESTORE_REHEARSAL_EVIDENCE`
- `Get-Content docs\PRODUCTION_RELEASE_GATE.md`
- `Get-Content docs\DEPLOYMENT.md`
- `Get-Content docs\ROADMAP.md`
- `Get-Content docs\TROUBLESHOOTING.md`
- `rg --files docs | rg "restore|rehearsal|backup|rollback"`
- `Test-NetConnection -ComputerName localhost -Port 5433`
- Backend `.\mvnw.cmd -B -Dtest=QuizApplicationTests test` with process-scoped
  non-production PostgreSQL env and `JAVA_TOOL_OPTIONS=-Duser.timezone=UTC`
- `npm run gate:backup-rollback`

## Task 6: Docs Contradiction Audit

Status: PASS

Audit scope:

- Actuator metrics exposure.
- Test counts.
- Production-ready and release-ready claims.
- Staging smoke status.
- Backup/restore rehearsal status.
- Release gate status.

Corrections made:

- `docs/deploy.md` distinguishes Actuator exposure from anonymous access:
  `/actuator/health` and `/actuator/info` remain public, while
  `/actuator/metrics` and `/actuator/metrics/**` require authenticated
  operator access or a future private monitoring channel.
- `docs/PRODUCTION_RELEASE_GATE.md`, `docs/DEPLOYMENT.md`, and
  `docs/technical-audit-report.md` now reflect Task 2 accurately: local
  `gate:secret-scan` PASS came from fixing fallback walking over ignored local
  `.env` files when Node could not spawn Git. GitHub Production Release Gate
  remains the release authority.
- `docs/quality-upgrade-plan-8.0.md` now reflects Task 1 as PARTIAL: CI for the
  audited HEAD was verified PASS, but Production Release Gate still needs
  verification for the exact candidate.
- `docs/production-hardening-status.md` and `docs/TESTING.md` no longer present
  mixed historical test counts as fresh current evidence. They now require a
  fresh regression run before exact counts are quoted in release notes.
- `docs/README.md` now links to `docs/restore-rehearsal-checklist.md`.

Current truthful release-gate status after audit:

- Secret scan: PASS local, `findingCount: 0`.
- Frontend static build: PASS local from Task 3.
- Production env validation: PASS with safe fixture and invalid fixture; real
  production env validation still needs real values.
- Source integrity: PASS local on clean PR HEAD
  `5c74f6e08716c9761ee6b6042963b8ad7214d9e7` after Task 7b fixed the
  `spawnSync git EPERM` crash path to return BLOCKED instead of crashing when
  Git cannot be executed from Node.
- Staging smoke: PASS by manual Wave 2 run with configured staging env. OAuth
  browser login/callback remains NEEDS MANUAL VERIFICATION.
- Backup/rollback: gate PASS after Wave 3 created
  `docs/restore-rehearsal-evidence.md`; evidence is limited to
  schema/Flyway/app-start rehearsal and does not prove backup dump restore.

Commands used:

- `rg -n "management\.endpoints|actuator|metrics|health,info,metrics|exposure\.include" backend src .github package.json docs`
- `rg -n "production-ready|production ready|fully verified|release-ready|release ready|all gates pass|GO|NO-GO|PASS|BLOCKED|NEEDS VERIFICATION|staging smoke|restore rehearsal|backup-rollback|source-integrity|secret-scan|frontend-static-build|production-env" docs`
- `rg -n "\b[0-9]+\s*(tests?|Playwright|backend tests|frontend tests)|Playwright tests|test counts|98|29|1,050|1050" docs README.md package.json .github\workflows`
- `rg --files docs | rg "(^docs/README\.md$|README|DEPLOYMENT|PRODUCTION_RELEASE_GATE|deploy\.md|quality-upgrade-plan|phase-1-quality-evidence|restore-rehearsal-checklist)"`
- `Get-Content` targeted sections from the current docs and actuator config.

## Wave 1 Final Verification

Date: 2026-08-09

PR HEAD: `5c74f6e08716c9761ee6b6042963b8ad7214d9e7`

Status: MERGEABLE FOR AUDIT/GATE/DOCS HARDENING, NOT PRODUCTION-READY

Verified GitHub Actions for PR HEAD:

- Workflow `CI` run `31268078063`: completed with conclusion `success`.
- CI job `Backend tests and frontend checks`: completed with conclusion
  `success`.
- Verified successful CI steps include backend tests, production database safety
  guards, PostgreSQL Flyway/Hibernate validate, frontend JavaScript syntax, and
  frontend smoke tests.
- A second `CI` run for the same SHA, run `31268074284`, also completed with
  conclusion `success`.

Production Release Gate:

- No `Production Release Gate` workflow run was found for PR HEAD
  `5c74f6e08716c9761ee6b6042963b8ad7214d9e7` in the Actions runs returned for
  that SHA.
- No production release-gate artifact was verified for this PR HEAD.
- This keeps the release decision below production-ready even though the PR is
  mergeable for audit/gate/docs hardening.

Local checks for PR HEAD:

- `npm run gate:secret-scan`: PASS.
- `npm run gate:source-integrity`: PASS when run outside the sandbox on a clean
  working tree. The sandboxed run returns BLOCKED because Node cannot spawn Git
  in that environment.
- `git status --short`: clean.
- `git diff --stat`: no output.
- `git diff --check`: PASS, no output.

Remaining blocked or partial controls:

- `backup-rollback-readiness`: PASS by local gate after Wave 3 evidence file,
  but still PARTIAL / NEEDS BACKUP-DUMP VERIFICATION because no sanitized
  backup artifact was restored and `/api/health` was not smoked against a
  launched restored app server.

Remaining manual verification:

- Google OAuth full browser login/callback is not covered by
  `staging-smoke.mjs` and remains NEEDS MANUAL VERIFICATION.
- The backend URL used by Wave 2 is a Render deployed backend, but this document
  does not prove it is connected to an isolated staging database.

## Wave 2 Staging Smoke Verification

Date: 2026-08-09

Status: PASS for `staging-smoke.mjs`, with limitations

Manual command inputs reported:

- `STAGING_BACKEND_URL=https://quiz-app-xd9m.onrender.com`
- `STAGING_FRONTEND_URL=https://quiz-9j3357ei0-nguyenhdung2006s-projects.vercel.app/`
- `STAGING_TEST_USER_HINT=24020092@gmail.com`
- Command: `npm run gate:staging-smoke`

Manual result reported:

- `[PASS] staging-smoke`

What the script actually verifies:

- Required env vars are present and non-empty.
- `STAGING_BACKEND_URL` and `STAGING_FRONTEND_URL` use HTTPS and are not
  localhost, `127.0.0.1`, placeholder, or `example.com`.
- `GET /api/health` on the backend returns a 2xx response.
- `GET /api/csrf` on the backend returns a 2xx JSON response and issues a
  cookie.
- The frontend root returns a 2xx or 3xx response.

What the script does not verify:

- Google OAuth full browser login/callback.
- Authenticated user flows after OAuth login.
- That the Render backend is connected to an isolated staging database.
- Full backup dump restore and restored `/api/health` smoke evidence.
- Production readiness.

## Wave 3 Backup/Restore Rehearsal

Date: 2026-08-09

Status: PARTIAL PASS for schema/Flyway/app-start rehearsal; backup dump restore
still NEEDS VERIFICATION

Target:

- Disposable Docker PostgreSQL on `localhost:5433`.
- Database: `quiz_app_restore_rehearsal`.
- Non-production only; production Supabase was not touched.

What was identified:

- The repo does not currently include an automated backup/dump restore process.
- `npm run gate:backup-rollback` maps to
  `scripts/production-release-gate/backup-rollback-readiness.mjs`.
- The gate checks required runbook docs/terms plus concrete evidence via
  `docs/restore-rehearsal-evidence.md` or
  `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`; it does not run `pg_dump`, `psql`,
  Flyway, or `/api/health` itself.

Real rehearsal command result:

- Backend `.\mvnw.cmd -B -Dtest=QuizApplicationTests test` PASS with process
  env pointing to the disposable PostgreSQL target,
  `SPRING_PROFILES_ACTIVE=prod`, `FLYWAY_ENABLED=true`, `JPA_DDL_AUTO=validate`,
  and `JAVA_TOOL_OPTIONS=-Duser.timezone=UTC`.
- The first attempt without `JAVA_TOOL_OPTIONS=-Duser.timezone=UTC` failed
  before migration because PostgreSQL rejected JVM timezone `Asia/Saigon`.
- The successful run connected to PostgreSQL 16.14, validated 4 migrations,
  applied versions 1 through 4, initialized Hibernate with validate, and loaded
  the Spring context.

Evidence file:

- `docs/restore-rehearsal-evidence.md`

Limitations:

- No sanitized backup/dump artifact was supplied or restored.
- No production Supabase DB was touched.
- No restored app server was launched, so `/api/health` was not smoked.
- This does not make the project production-ready.

## Wave 4 Render Memory And Alerting Evidence

Date: 2026-08-09

Status: MEMORY RESTART CONFIRMED / METRICS UNAVAILABLE / ALERTING NOT VERIFIED

Evidence provided from Render screenshots:

- Render Events confirms one memory failure: `Instance failed ... Ran out of
  memory (used over 512MB)` at August 7, 2026 at 11:18 PM.
- Render Events confirms recovery: `Service recovered` at August 7, 2026 at
  11:23 PM.
- Render Metrics is on a Free instance and states that a paid instance is
  required to view application metrics such as memory and CPU usage.
- Recent logs show normal auth, analytics, and sync activity plus
  `SecureRandom` WARN messages. The last-hour screenshot does not show a new
  OOM event.
- No evidence was provided for an alert channel configuration or a delivered
  notification.

Current conclusion:

- The memory restart risk is confirmed.
- Quantitative memory/CPU metrics are unavailable from the current Render Free
  instance and remain not verified through another observability backend.
- Alerting remains NOT VERIFIED.
- Monitoring is not production-ready.

Next action:

- Upgrade the Render instance or connect external observability/alerting.
- Capture memory, CPU, request, and log evidence around the incident class.
- Verify alert delivery with a real delivered notification before claiming
  monitoring readiness.
