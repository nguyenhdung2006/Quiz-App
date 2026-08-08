# Phase 1 Quality Evidence

Date: 2026-08-08

Branch: `chore/audit-reconciliation-and-upgrade`

Repository: `nguyenhdung2006/Quiz-App`

Audited HEAD: `adc2b0bb825dbd6397bdba3ea67656d2b676f7d4`

This document records verified evidence for the Phase 1 quality tasks from
`docs/quality-upgrade-plan-8.0.md`. Do not mark a control PASS here unless it
was verified against the exact commit above.

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

Status: BLOCKED / NEEDS VERIFICATION

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
- `docs/restore-rehearsal-evidence.md`: MISSING.
- `RELEASE_RESTORE_REHEARSAL_EVIDENCE`: MISSING.
- `npm run gate:backup-rollback`: BLOCKED.

Safe docs added:

- `docs/restore-rehearsal-checklist.md` was added as a preparation checklist.
  It is not completed evidence and must not be treated as proof of restore
  success.

Conditions required to move from BLOCKED to PASS:

- Perform a real restore rehearsal on a non-production database.
- Do not touch production DB and do not use production credentials.
- Record only safe metadata: source backup ID/timestamp, target
  non-production database identifier, restore tool/command shape, verification
  result, `/api/health` smoke result, operator, and timestamp.
- Create `docs/restore-rehearsal-evidence.md` only after the real rehearsal is
  complete, or set `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true` only when the
  release record links to equivalent external evidence.
- Run `npm run gate:backup-rollback` and require `[PASS]
  backup-rollback-readiness`.

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

- `docs/deploy.md` no longer says only `/actuator/health` and
  `/actuator/info` are exposed. It now matches source/config:
  `/actuator/metrics` and `/actuator/metrics/**` are currently public and must
  remain an intentional deployment policy or be protected with matching gate
  updates.
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
- Source integrity: NEEDS VERIFICATION on a clean release candidate because this
  checkout is intentionally dirty with docs/script evidence changes.
- Staging smoke: BLOCKED because `STAGING_BACKEND_URL`,
  `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT` are missing.
- Backup/rollback: BLOCKED because `docs/restore-rehearsal-evidence.md` and
  `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true` are missing.

Commands used:

- `rg -n "management\.endpoints|actuator|metrics|health,info,metrics|exposure\.include" backend src .github package.json docs`
- `rg -n "production-ready|production ready|fully verified|release-ready|release ready|all gates pass|GO|NO-GO|PASS|BLOCKED|NEEDS VERIFICATION|staging smoke|restore rehearsal|backup-rollback|source-integrity|secret-scan|frontend-static-build|production-env" docs`
- `rg -n "\b[0-9]+\s*(tests?|Playwright|backend tests|frontend tests)|Playwright tests|test counts|98|29|1,050|1050" docs README.md package.json .github\workflows`
- `rg --files docs | rg "(^docs/README\.md$|README|DEPLOYMENT|PRODUCTION_RELEASE_GATE|deploy\.md|quality-upgrade-plan|phase-1-quality-evidence|restore-rehearsal-checklist)"`
- `Get-Content` targeted sections from the current docs and actuator config.
