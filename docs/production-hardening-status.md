# Production Hardening Status

Last updated: 2026-07-31

This file is the reconciliation matrix for `docs/technical-audit-report.md`,
current source code, tests, configuration, CI, and deployment docs. Code and
test evidence override older audit text.

## Input Verification

| File | SHA-256 | Duplicate | Role |
| --- | --- | --- | --- |
| `C:\Users\nguye\.codex\attachments\9839f0b4-1d95-4b4b-a925-6ef8a9f3620a\pasted-text.txt` | `3A2E439CA866F3247EB7C75530852FC1E42FD85ED8C0A62EBAF983D0912F666A` | No | Master command / source file supplied this run |
| `SOURCE_FILE_2` | `UNKNOWN - not supplied in this workspace` | Unknown | Requested by command but not available |
| `docs/technical-audit-report.md` | `19E68BA02E0EA998A2E8653F7EA7F2C1992859964007AE658C77E83772767335` | No | Original technical audit report |

## Current Gate

Production gate: `NOT_READY`.

Reason: code hardening tests pass, but release evidence is incomplete. The
local gate has `source-integrity=FAIL` because this task leaves uncommitted
changes by instruction, `production-env-validation=FAIL` because production env
vars are not loaded in this workspace, and `backup-rollback-readiness` plus
`staging-smoke` are `BLOCKED` because required external evidence is absent.

Original audit score: `64/100`.

Reassessed score: `84/100`.

The score improved because P0 integrity, CSRF, production schema safety,
tombstone sync, observability, and release-gate controls are now implemented
with tests. It is not higher because operational release evidence is missing,
OpenAPI/pagination/query optimization remain partial, and the AI limiter is
intentionally in-memory.

## Audit Reconciliation Matrix

| Audit ID | Severity | Finding | Evidence code hiện tại | Evidence test hiện tại | Trạng thái | Gap còn lại | Hành động |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | High | Quiz/progress trusted client aggregates | `VocabularyService.recordQuizResult` resolves answers against current user's words and recomputes total/correct/wrong/score/combo/XP/achievements | `BackendHardeningTests` forged quiz tests, `mvnw test` PASS | VERIFIED_FIXED | No server-issued attempt/replay token | Track anti-replay only if product needs it |
| A-02 | High | Sync can overwrite server-managed stats/mastery | `SyncService.applyWordRequest` accepts content fields and calls `ensureStats` without applying incoming stats/mastered | `syncPayloadCannotOverwriteServerManagedProgressFields`, `mvnw test` PASS | VERIFIED_FIXED | Review local fallback can still diverge until cloud confirms | Keep documented local-first limitation |
| A-03 | High | CSRF disabled with cookie sessions | `SecurityConfig` enables Cookie CSRF, `/api/csrf`, restricted CORS headers, POST logout | `CsrfSecurityTests`, Playwright CSRF helper tests PASS | VERIFIED_FIXED | Real deployed OAuth browser flow not run here | Run staging/prod OAuth smoke before release |
| A-04 | High | Production migration defaults unsafe | `application-prod.yml`, Flyway migrations V1-V4, `ProductionDatabaseSafetyGuard` | `DatabaseSchemaTests`, `ProductionDatabaseSafetyGuardTests`, CI workflow | VERIFIED_FIXED | Production DB state not accessible from workspace | Validate staging/prod env and schema history |
| A-05 | High | No server-side delete/tombstone semantics | `SyncService`, `WordTombstone`, migrations V3/V4, `wordUid`, `deletions` | `SyncContractV2Tests`, Playwright tombstone/stale-device tests PASS | VERIFIED_FIXED | Tombstone garbage collection intentionally absent | Add retention policy only after real data age exists |
| A-06 | Medium | CORS allowed wildcard headers | `SecurityConfig.corsConfigurationSource` enumerates allowed origins/methods/headers | `CsrfSecurityTests` and source inspection | VERIFIED_FIXED | Env origins still must be exact in deployment | Gate validates `CORS_ALLOWED_ORIGINS` |
| A-07 | Medium | Security headers not explicit | Security config includes core auth/CSRF/CORS; docs require hosting/security review | No dedicated CSP/HSTS test | PARTIALLY_FIXED | CSP/HSTS/referrer policy not fully asserted in tests | Add explicit headers and tests later |
| A-08 | Medium | In-memory AI rate limiter | `AiRateLimitService` configurable minute/day per action/user, metrics on hit | `AiRateLimitTests`, `ObservabilityAndRateLimitTests` PASS | VERIFIED_FIXED | Not distributed; resets per JVM | Upgrade only for multi-instance/cost/abuse evidence |
| A-09 | Medium | Observability too thin | Request ID filter, MDC cleanup, request metrics, domain counters, actuator metrics | `ObservabilityAndRateLimitTests` PASS | VERIFIED_FIXED | No external APM/Sentry configured | Add external monitoring when production use justifies |
| A-10 | Medium | Frontend monolith/global state | Central `quizApiFetch` and sync helpers reduce API duplication | Playwright smoke PASS | PARTIALLY_FIXED | `app.js` remains large; no ES module split | Incremental modularization, not rewrite |
| A-11 | Medium | Backend God service | `SyncService` extracted; `VocabularyService` still owns CRUD/quiz/starter import | Backend tests PASS | PARTIALLY_FIXED | Quiz/CRUD/snapshot services not fully separated | Continue small service extraction |
| A-12 | Medium | Full scans/query bottlenecks | Some repository queries exist; normalized duplicate still streams user words | Backend tests PASS, no performance benchmark | PARTIALLY_FIXED | Review/analytics/snapshot pagination and query optimization incomplete | Add measured query work before scale |
| A-13 | Medium | API contract maturity/OpenAPI missing | `docs/API.md` documents current endpoints, CSRF, sync V2, errors | Docs/source inspection | PARTIALLY_FIXED | No generated OpenAPI contract tests | Add OpenAPI spec/generation |
| A-14 | Medium | Profile direct save underused | `PUT /api/profile` exists; frontend still sync-centric | Backend/profile tests inside full suite | PARTIALLY_FIXED | Frontend direct profile save E2E not proven | Add Playwright/profile cloud test |
| A-15 | Low | Misleading `[AUTH]` generic logs | `GlobalExceptionHandler` no longer uses old generic auth tag for all errors | Backend tests/log source inspection | VERIFIED_FIXED | Some auth-specific logs remain by design | No action |
| A-16 | Low | Unused archive/assets/dependencies | Archive documented as legacy; no removal requested | N/A | NOT_APPLICABLE | Search noise remains | Do not delete archive without explicit approval |
| A-17 | P0 gate | Release gate incomplete | Gate scripts and workflow exist | Gate report `NO-GO` | PARTIALLY_FIXED | Env/staging/restore evidence and clean tree missing | Complete external release checklist |
| A-18 | Testing | Missing forged/CSRF/tombstone tests | Tests now cover forged quiz, CSRF, Sync V2 tombstones, observability/rate limit | `mvnw test` 91 PASS, Playwright 28 PASS | VERIFIED_FIXED | Load/performance and deployed OAuth E2E not run | Add after staging access |

## Status Counts

| Status | Count |
| --- | ---: |
| VERIFIED_FIXED | 11 |
| PARTIALLY_FIXED | 6 |
| NOT_FIXED | 0 |
| REGRESSED | 0 |
| NOT_APPLICABLE | 1 |
| UNVERIFIED | 0 |

## Items 1-7

| Item | Initial state | Work completed | Test evidence | Final status |
| --- | --- | --- | --- | --- |
| 1. Business integrity | Client-trusted quiz/sync progress | Server recomputes quiz results; sync ignores server-managed stats | BackendHardeningTests PASS | VERIFIED_FIXED |
| 2. CSRF/session | CSRF disabled | Cookie CSRF, token endpoint, frontend API client, POST logout | CsrfSecurityTests and Playwright CSRF tests PASS | VERIFIED_FIXED |
| 3. Migration safety | Env-discipline-based production DB safety | Prod profile, Flyway V1-V4, safety guard, CI migration/validate | DatabaseSchemaTests and guard tests PASS | VERIFIED_FIXED |
| 4. Tombstone/sync | Delete queue only | Sync Contract V2, `wordUid`, tombstones, legacy id bridge | SyncContractV2Tests and Playwright sync tests PASS | VERIFIED_FIXED |
| 5. Production gate | Not formalized | Gate scripts/workflow/report exist | Gate report NO-GO with PASS/FAIL/BLOCKED controls | PARTIALLY_FIXED |
| 6. Maintainability/API/scale | God services and monolith | `SyncService`, central API client, docs | Full test suites PASS | PARTIALLY_FIXED |
| 7. Observability/rate limit | Thin counters/logs | Request ID, MDC, metrics, configurable in-memory AI limiter | Observability/rate-limit tests PASS | VERIFIED_FIXED |

## Tests Run 2026-07-31

| Command | Result | Evidence |
| --- | --- | --- |
| `backend\.mvnw.cmd test` | PASS | 91 tests, 0 failures |
| `backend\.mvnw.cmd clean package -DskipTests` | PASS | Jar built at `backend/target/quiz-0.0.1-SNAPSHOT.jar` |
| `node --check frontend\js\config.js` | PASS | Exit 0 |
| `node --check frontend\js\app.js` | PASS | Exit 0 |
| `node --check frontend\js\login.js` | PASS | Exit 0 |
| `node --check frontend\js\ai-explain.js` | PASS | Exit 0 |
| `node --check frontend\js\analytics-dashboard.js` | PASS | Exit 0 |
| `node --check frontend\js\review-today.js` | PASS | Exit 0 |
| `node --check frontend\js\learning-studio.js` | PASS | Exit 0 after XSS cleanup |
| `npm run build:frontend` | PASS | `frontend-static-build` PASS |
| `npx playwright test` | PASS | 28 tests, 0 failures |
| `npm run gate:secret-scan` | PASS | `release-gate-artifacts/controls/secret-scan.json` |
| `npm run gate:source-integrity` | FAIL | Dirty working tree from this uncommitted task |
| `npm run gate:validate-env` | FAIL | Production env vars absent in workspace |
| `npm run gate:backup-rollback` | BLOCKED | Restore rehearsal evidence absent |
| `npm run gate:staging-smoke` | BLOCKED | Staging URLs/test identity absent |
| `git diff --check` | PASS | Exit 0 |

## Score Reassessment

| Category | Old score | New score | Evidence | Remaining limitation |
| --- | ---: | ---: | --- | --- |
| Architecture | 6 | 7 | SyncService extraction, clear module docs | VocabularyService/frontend still large |
| Code quality | 6 | 7 | Focused tests and smaller sync boundary | Some magic constants and duplicate policy |
| Business logic | 5 | 9 | Forged quiz/sync progress blocked | No quiz replay token |
| Database | 6 | 8 | Flyway V1-V4, prod validate guard | Production DB not verified here |
| API | 6 | 7 | CSRF/sync V2 docs and errors | No generated OpenAPI |
| Security | 5 | 8 | CSRF, CORS headers, secret scan | Deployed OAuth/CSP not fully proven |
| Performance | 5 | 6 | Better sync consistency | Query optimization/pagination partial |
| Testing | 7 | 9 | 91 backend + 28 frontend tests | No load/staging OAuth E2E |
| DevOps | 6 | 8 | CI/gate scripts/Flyway guard | Gate NO-GO until env/evidence clean |
| Observability | 5 | 8 | Request ID/MDC/metrics/counters | No external APM |

Final verdict: `NOT_READY` for production release until external release-gate evidence is complete. Code-level hardening is substantially improved and suitable for staging validation.
