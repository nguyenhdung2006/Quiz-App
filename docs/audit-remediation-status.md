# Audit Remediation Status

Last updated: 2026-08-15 00:55 +07

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
| Production env gate | BLOCKED | Required production env vars and deployment evidence are absent in this local workspace |
| Backup rollback gate before fix | PASS incorrectly | Existing evidence file says `PARTIAL PASS` |
| Backup rollback gate after fix | BLOCKED correctly | `npm run gate:backup-rollback` |
| Staging smoke gate | BLOCKED | Missing `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, `STAGING_TEST_USER_HINT` |
| Lint/typecheck | MISSING | No lint/typecheck scripts are defined |

## AUD Triage

| ID | Status | Severity | Priority | Difficulty | Evidence | Root cause | Plan | Test needed | Fix now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | FIXED in working tree | S4 | P0 | D2 | `backup-rollback-readiness.mjs` accepted `docs/restore-rehearsal-evidence.md` although `Result` is `PARTIAL PASS` and backup/health are not verified | Gate checked file existence and keywords, not evidence quality | Parse required evidence fields and block incomplete evidence | PASS/PARTIAL/FAIL/malformed fixtures | Done |
| AUD-002 | FIXED | S4 | P0 | D2 | Workflow previously wrote safe fixture output to `production-env-validation`; local env without deployment evidence now produces `BLOCKED` | Release gate confused validator self-test with deployed environment proof | Safe fixture writes `production-env-validator-self-test`; real `production-env-validation` requires redacted deployment source/id/timestamp and rejects fixture-like values | `npm run test:gate:validate-env`; `npm run test:gate:report`; `npm run gate:validate-env` | Done |
| AUD-003 | FIXED | S4 | P1 | D3 | `/api/sync` now has a servlet filter before controller/Jackson with configurable byte cap | Bean Validation item caps were after deserialization | `POST /api/sync` is capped by `app.sync.max-request-body-bytes` / `SYNC_MAX_REQUEST_BODY_BYTES` before deserialization and returns 413 `ApiError` | Content-Length, malformed oversized, no-length stream, and normal request tests | Done |
| AUD-004 | PARTIALLY FIXED | S3 | P1 | D3 | Stale push now opens a feature-flagged recovery panel without applying cloud first; export/cancel/offline/failure paths preserve local state; `Use cloud` requires backup and confirmation | Client has last sync metadata and current local data, but no common baseline or reliable change set for already-stale devices | Keep `Merge safely` and `Keep local as new changes` disabled until a compatible baseline/change-set design exists | Playwright stale/recovery coverage for boundary, flag on/off, export, use-cloud success/failure, revision change, tombstones, account isolation | Done for fail-closed entry point |
| AUD-005 | PARTIALLY FIXED | S3 | P1 | D4 | `Audit005CapacityTests` now measures 100/1k/5k snapshots, `/api/sync`, quiz submit, review queue, and analytics; query N+1 paths are reduced, but snapshots still return full vocab/tombstones | Snapshot design still favors simplicity; no pagination/delta/retention yet | Keep `/api/sync` compatible; use bulk/fetch-graph/query-level reductions now; defer delta/page/tombstone GC until real capacity trigger and client watermark design exist | Query-count guardrails pass locally; remaining work needs real PostgreSQL/staging/load evidence | Done for measured N+1/query-cost hardening only |
| AUD-006 | BLOCKED | S3 | P1 | D3 | Restore evidence is partial; staging smoke is blocked locally; OAuth/authenticated CRUD/sync/delete evidence is absent; gate now requires authenticated staging evidence before `staging-smoke` can PASS | External staging URL/test identity, sanitized backup/restore artifact, and OAuth/authenticated smoke evidence are missing from this workspace | Keep release gate `NO-GO`; collect real non-prod restore plus authenticated staging smoke using the evidence checklists | `npm run test:gate:staging-smoke`; `npm run gate:staging-smoke`; `npm run gate:backup-rollback`; `npm run gate:report` | Blocked by env/credentials/evidence |
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
| NEW-001 | S3 | `production-release-gate-report.json` aggregated old controls from 2026-07-31 while local baseline on 2026-08-11 passed 98 backend and 29 frontend tests | `generate-report.mjs` accepted existing control artifacts without commit-SHA checks | Report now marks controls without matching `commitSha` as `BLOCKED` | Done with AUD-002 |

## Fixed In This Batch

| ID | Files changed | Behavior changed | Tests/checks |
| --- | --- | --- | --- |
| AUD-001 | `scripts/production-release-gate/backup-rollback-readiness.mjs`, `scripts/production-release-gate/backup-rollback-readiness.test.mjs`, `package.json` | Backup readiness now blocks partial restore evidence and requires complete backup, restore, app verification, health, and final PASS fields | `npm run test:gate:backup-rollback` PASS; `npm run gate:backup-rollback` returns BLOCKED for current partial evidence |
| AUD-002 | `scripts/production-release-gate/validate-production-env.mjs`, `scripts/production-release-gate/generate-report.mjs`, `scripts/production-release-gate/lib.mjs`, `.github/workflows/production-release-gate.yml`, `package.json`, docs | Production env fixture is now a self-test; real production env validation is BLOCKED without deployment evidence and FAILS unsafe/fixture-like values; report blocks stale control artifacts | `npm run test:gate:validate-env` PASS; `npm run test:gate:report` PASS; `npm run gate:validate-env` BLOCKED in this local workspace |
| AUD-003 | `backend/src/main/java/com/quizapp/config/SyncRequestBodyLimitFilter.java`, `backend/src/main/resources/application.properties`, `backend/src/test/java/com/quizapp/SyncRequestBodyLimitTests.java`, docs | `/api/sync` request bodies are capped before JSON deserialization; oversized bodies return 413 with the existing `ApiError` envelope | `cd backend; .\mvnw.cmd -Dtest=SyncRequestBodyLimitTests test` PASS |
| AUD-004 | `frontend/js/app.js`, `frontend/css/modern.css`, `tests/smoke.spec.js`, docs | Stale devices no longer apply cloud snapshots or flush pending deletes before the stale guard. A feature-flagged recovery panel offers export, cancel, and backup-first `Use cloud`; unsafe merge/local-as-new choices are disabled. | `npx playwright test -g "stale\|old sync metadata"` PASS, 14 tests |
| AUD-005 | `backend/src/main/java/com/quizapp/vocab/VocabularyRepository.java`, `backend/src/main/java/com/quizapp/vocab/WrongBankRepository.java`, `backend/src/main/java/com/quizapp/vocab/VocabularyService.java`, `backend/src/main/java/com/quizapp/vocab/SyncService.java`, `backend/src/main/java/com/quizapp/review/SpacedRepetitionService.java`, `backend/src/main/java/com/quizapp/analytics/LearningAnalyticsService.java`, `backend/src/test/java/com/quizapp/Audit005CapacityTests.java`, `docs/audit-005-capacity-baseline.md`, docs | Added local capacity measurements and query-count guardrails; removed stats lazy-load N+1 from full snapshot/review/analytics paths; bulk-loads quiz answer words/wrong-bank entries; reuses loaded sync maps; prefilters review due/tag/level at DB level. `/api/sync` contract, schema, tombstone semantics, and full snapshot shape remain unchanged. | `cd backend; .\mvnw.cmd -Dtest=Audit005CapacityTests test` PASS; targeted sync/analytics/review/capacity suite PASS; `cd backend; .\mvnw.cmd test` PASS, 106 tests; `cd backend; .\mvnw.cmd clean package -DskipTests` PASS |
| AUD-006 | `scripts/production-release-gate/staging-smoke.mjs`, `scripts/production-release-gate/staging-smoke.test.mjs`, `docs/staging-auth-smoke-checklist.md`, docs | Staging smoke remains fail-closed unless basic health/CSRF/frontend checks and real authenticated OAuth/session, CRUD, sync, delete/tombstone, logout, RTO/RPO evidence are present. No real restore/OAuth smoke was run in this workspace. | Backend 102 tests PASS; frontend 41 tests PASS; package/build PASS; gate unit tests PASS; `gate:validate-env`, `gate:backup-rollback`, `gate:staging-smoke` BLOCKED; `gate:report` NO-GO |

## Commits

| ID | Commit |
| --- | --- |
| AUD-001 | `081d21d fix(audit): block partial restore evidence gate` |
| AUD-002 | `37c16e0 fix(audit): harden production environment gate` |
| AUD-003 | `72b5d00 fix(audit): cap sync request body before deserialization` |
| AUD-004 | this commit (`fix(audit): add fail-closed stale recovery entry point`) |
| AUD-005 | this commit (`perf(audit): reduce sync and analytics query cost`) |
| AUD-006 | this commit (`fix(audit): harden production verification evidence`) |

## Blocked

- Staging/OAuth smoke requires real staging URLs and non-secret test identity metadata.
- Authenticated staging smoke also requires `docs/staging-auth-smoke-evidence.md` or `STAGING_AUTH_SMOKE_EVIDENCE_FILE` with real OAuth/session, CRUD, sync, delete/tombstone, logout, RTO/RPO, commit, environment, operator, and timestamp evidence.
- Production env validation requires redacted real deployment values plus `RELEASE_ENV_SOURCE`, `RELEASE_DEPLOYMENT_ID`, and `RELEASE_ENV_CAPTURED_AT`; this local workspace should not invent them.
- Full backup restore requires a real sanitized/non-production backup artifact and restored app health smoke.
- Source integrity through Node is blocked in this sandbox by `spawnSync git EPERM`; direct Git commands are available.
- AUD-005 still has full snapshot payload and tombstone retention risk: local query counts are bounded, but no real release/load evidence proves production behavior.

## Do Not Do Now

- Do not claim production-ready from local tests or stale release artifacts.
- Do not implement delta sync/device watermarks before real payload/query/load metrics justify the larger protocol change.
- Do not delete candidate-unused CSS without visual regression coverage.
- Do not rewrite the frontend to React/Vue/Angular for these findings.
- Do not introduce Redis, queues, Kubernetes, or microservices for current scale.

## Highest Value Next Steps

1. Design a backwards-compatible client baseline/change-set for future safe stale merges without pretending it fixes already-stale devices.
2. Run or prepare the staging restore/OAuth/CRUD/sync/delete evidence checklist without marking missing external work PASS.
3. Add modal focus/Escape/restore behavior and a keyboard Playwright test.
4. Build import preview plus backup-before-replace, then add localStorage quota failure feedback.
5. Decide metrics exposure/alert ownership policy and align security tests with it.

Current maturity after this batch: hardened MVP / portfolio-ready / controlled beta candidate. It is not production-ready because production env, real backup restore, and staging OAuth evidence are still incomplete.
