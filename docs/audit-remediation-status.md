# Audit Remediation Status

Last updated: 2026-08-11 03:30 +07

This document tracks the re-audit of `docs/full-project-audit.md` dated
2026-08-09. Source at `HEAD` remains the authority; the audit report is treated
as a hypothesis list.

## Baseline

| Check | Result | Evidence |
| --- | --- | --- |
| Branch | `chore/audit-reconciliation-and-upgrade` | `git branch --show-current` |
| Commit before fix | `2d74d4560f61b65da98b04c4edf2981820374402` | `git rev-parse HEAD` |
| Working tree before fix | dirty due untracked audit attachments only | `git status --short` showed `docs/full-project-audit.docx`, `docs/full-project-audit.md`, `full-project-audit.docx`, `~$ll-project-audit.docx` |
| Commits since 2026-08-09 | 4 docs/evidence commits | `git log --since='2026-08-09 00:00:00'` |
| Backend tests | PASS, 98 tests, 0 failures/errors/skips | `cd backend; .\mvnw.cmd test` |
| Frontend smoke | PASS, 29 Chromium tests | `npm run test:frontend` |
| Frontend static build | PASS | `npm run build:frontend` |
| Backend package | PASS | `cd backend; .\mvnw.cmd clean package -DskipTests` |
| Secret scan gate | PASS, `findingCount: 0` | `npm run gate:secret-scan` |
| Source integrity gate | BLOCKED | Node `spawnSync git EPERM`; direct Git commands work |
| Production env gate | FAIL | Required production env vars are absent in this local workspace |
| Backup rollback gate before fix | PASS incorrectly | Existing evidence file says `PARTIAL PASS` |
| Backup rollback gate after fix | BLOCKED correctly | `npm run gate:backup-rollback` |
| Staging smoke gate | BLOCKED | Missing `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, `STAGING_TEST_USER_HINT` |
| Lint/typecheck | MISSING | No lint/typecheck scripts are defined |

## AUD Triage

| ID | Status | Severity | Priority | Difficulty | Evidence | Root cause | Plan | Test needed | Fix now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | FIXED in working tree | S4 | P0 | D2 | `backup-rollback-readiness.mjs` accepted `docs/restore-rehearsal-evidence.md` although `Result` is `PARTIAL PASS` and backup/health are not verified | Gate checked file existence and keywords, not evidence quality | Parse required evidence fields and block incomplete evidence | PASS/PARTIAL/FAIL/malformed fixtures | Done |
| AUD-002 | Confirmed | S4 | P0 | D2 | Local `gate:validate-env` fails without real deployment env; workflow also has fixture paths | Release gate validates provided env values but does not prove deployed Render/Vercel settings | Separate fixture self-test from real deployed-env attestation | Fixture matrix plus real redacted deployment evidence freshness check | Yes, next |
| AUD-003 | Confirmed | S4 | P1 | D3 | `/api/sync` uses `@RequestBody SyncRequest`; item caps are Bean Validation after deserialization | No pre-Jackson byte cap for sync request body | Add configurable request byte filter for `/api/sync`, return 413 envelope, client UX | Content-Length, chunked/no-length, boundary, client 413 tests | Yes, after AUD-002 |
| AUD-004 | Partially fixed | S3 | P1 | D3 | Playwright blocks stale push; UI mainly says refresh before syncing | Data overwrite protection exists; recovery choice/artifact UX is thin | Add recovery flow: pull cloud, export local backup, choose merge/replace/cancel | Stale local changes recovery tests | Later batch B/C |
| AUD-005 | Confirmed | S3 | P1 | D4 | `SyncService.snapshot()` returns full vocab/tombstones; sync loads full live words and tombstones | Snapshot design favors simplicity; no pagination/delta/retention yet | Measure first, bulk/paginate only on trigger | Query count, 10k-word fixture, payload/heap measurements | Not before metrics |
| AUD-006 | Confirmed/BLOCKED | S3 | P1 | D3 | Restore evidence is partial; staging smoke is blocked locally; OAuth real flow not run | External staging/backup/OAuth evidence missing | Run non-prod restore from real sanitized dump and OAuth/CRUD/sync/delete smoke | Runbook checklist with artifacts | Blocked by env/credentials |
| AUD-007 | Confirmed | S2 | P1 | D2 | `SecurityConfig` permits `/actuator/metrics/**`; docs say alert delivery not verified | Metrics are public for low-friction ops; alert ownership unproven | Decide policy: keep public with reviewed list, or protect after monitoring auth | Security tests and release gate aligned with policy | Yes, small policy task |
| AUD-008 | Confirmed | S2 | P2 | D4 | `app.js`, `learning-studio.js`, and `modern.css` remain large global files | Static frontend grew through feature accretion | Extract sync/import/session modules incrementally | Existing Playwright plus pure unit tests for merge helpers | Later |
| AUD-009 | Confirmed | S2 | P2 | D2 | `initPreview()` opens modal without focus trap/restore; tabs are mostly visual spans/buttons | Modal/tab behavior lacks centralized a11y manager | Add focus trap, Escape close, restore focus, ARIA tab semantics | Keyboard-only Playwright test | Yes, quick UI batch |
| AUD-010 | Confirmed | S2 | P2 | D2 | Mobile CSS wraps sidebar/status at <=620px; audit observed cramped 390px layout | Dense desktop app shell compressed into small viewport | Compact nav/status treatment for 320/390/768 and 200% zoom | Playwright screenshots/overflow checks | Yes, after a11y |
| AUD-011 | Confirmed | S2 | P2 | D3 | `SecurityConfig` CSP has `unsafe-inline`; `index.html` has `oncontextmenu` and `onclick` | Inline handlers remain in static HTML | Move handlers to JS and trial CSP report-only before enforce | CSP header tests plus smoke for buttons | Later security batch |
| AUD-012 | Confirmed | S2 | P2 | D2 | Report artifacts include stale 91/28 test counts while current baseline is 98/29 | Docs/artifacts can drift from current run | Add report freshness/SHA validation and update docs | Fixture controls with stale generatedAt/SHA | Yes, paired with AUD-002 |
| AUD-013 | Confirmed | S3 | P2 | D3 | Import uses `confirm` Replace/Merge and no automatic pre-replace backup | Destructive import relies on native confirm and user memory | Add preview modal, Replace/Merge/Cancel, pre-replace backup artifact, quota handling | Import replace/merge/quota tests | Later batch B |
| AUD-014 | Confirmed | S1 | P3 | D2 | Frontend analytics/review use `new Date()` local system timezone | Product timezone is implicit browser local time | Define product timezone policy before changing behavior | Date boundary tests | Not urgent |
| AUD-015 | Confirmed | S1 | P3 | D2 | `package.json` has no lint/typecheck/coverage script | Vanilla JS project lacks quality tooling | Add lightweight changed-file syntax/lint visibility first | CI script verifies changed JS | Later |
| AUD-016 | Confirmed candidate | S0 | P4 | D1 | `design-system.css` and `login-modern.css` are not linked by current HTML | Historical/unused CSS left in repo | Do not delete until reference and visual regression checks prove unused | Asset reference scan and screenshots | No |

## Additional Findings

| ID | Severity | Evidence | Root cause | Plan | Fix now |
| --- | --- | --- | --- | --- | --- |
| NEW-001 | S3 | `production-release-gate-report.json` aggregated old controls from 2026-07-31 while local baseline on 2026-08-11 passed 98 backend and 29 frontend tests | `generate-report.mjs` accepts existing control artifacts without freshness or commit-SHA checks | Require mandatory controls to carry current commit SHA/run timestamp, or mark stale controls BLOCKED | Yes, with AUD-002/AUD-012 |

## Fixed In This Batch

| ID | Files changed | Behavior changed | Tests/checks |
| --- | --- | --- | --- |
| AUD-001 | `scripts/production-release-gate/backup-rollback-readiness.mjs`, `scripts/production-release-gate/backup-rollback-readiness.test.mjs`, `package.json` | Backup readiness now blocks partial restore evidence and requires complete backup, restore, app verification, health, and final PASS fields | `npm run test:gate:backup-rollback` PASS; `npm run gate:backup-rollback` returns BLOCKED for current partial evidence |

Commit: this commit (`fix(audit): block partial restore evidence gate`).

## Blocked

- Staging/OAuth smoke requires real staging URLs and non-secret test identity metadata.
- Production env validation requires redacted real deployment values; this local workspace should not invent them.
- Full backup restore requires a real sanitized/non-production backup artifact and restored app health smoke.
- Source integrity through Node is blocked in this sandbox by `spawnSync git EPERM`; direct Git commands are available.

## Do Not Do Now

- Do not claim production-ready from local tests or stale release artifacts.
- Do not implement delta sync/device watermarks before payload/query metrics justify it.
- Do not delete candidate-unused CSS without visual regression coverage.
- Do not rewrite the frontend to React/Vue/Angular for these findings.
- Do not introduce Redis, queues, Kubernetes, or microservices for current scale.

## Highest Value Next Steps

1. Fix AUD-002/AUD-012/NEW-001 so release reports cannot use stale or fixture-only evidence as real deployment proof.
2. Add `/api/sync` byte cap before deserialization with a 413 API envelope and client message.
3. Run or prepare the staging restore/OAuth/CRUD/sync/delete evidence checklist without marking missing external work PASS.
4. Add modal focus/Escape/restore behavior and a keyboard Playwright test.
5. Build import preview plus backup-before-replace, then add localStorage quota failure feedback.

Current maturity after this batch: hardened MVP / portfolio-ready / controlled beta candidate. It is not production-ready because production env, real backup restore, staging OAuth, and bounded sync evidence are still incomplete.
