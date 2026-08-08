# Production Hardening Status

Last updated: 2026-08-08

This file is the reconciliation matrix for `docs/technical-audit-report.md`,
current source code, tests, configuration, CI, and deployment docs. Code and
test evidence override older audit text.

## Input Verification

| File | SHA-256 | Duplicate | Role |
| --- | --- | --- | --- |
| `C:\Users\nguye\.codex\attachments\9839f0b4-1d95-4b4b-a925-6ef8a9f3620a\pasted-text.txt` | `3A2E439CA866F3247EB7C75530852FC1E42FD85ED8C0A62EBAF983D0912F666A` | No | Master command / source file supplied this run |
| `SOURCE_FILE_2` | `UNKNOWN - not supplied in this workspace` | Unknown | Requested by command but not available |
| `docs/technical-audit-report.md` | Rewritten 2026-08-08 | No | Current synthesized audit; historical original is archived |

## Current Gate

Production gate: `NOT_READY`.

Reason: code hardening exists, but release evidence is incomplete until the
current commit has a clean release-gate run. `source-integrity` requires a clean
tree, production env validation needs real values for a production claim,
`backup-rollback-readiness` requires restore rehearsal evidence, and
`staging-smoke` requires staging URLs/test identity.

Original audit score: `64/100`.

Reassessed code-hardening score: `84/100`.

Production readiness remains about `6.2/10` because current source hardening is
not the same as completed production evidence.

The score improved because P0 integrity, CSRF, production schema safety,
tombstone sync, explicit response security headers, profile/avatar hardening,
observability, and release-gate controls are now implemented with tests. It is
not higher because operational release evidence is missing, OpenAPI/pagination
and query optimization remain partial, and the AI limiter is intentionally
in-memory.

Current 2026-08-08 blockers to keep visible:

- Render memory-limit restart is confirmed by Render Events at August 7, 2026
  11:18 PM, followed by service recovery at 11:23 PM. There is not enough
  evidence to conclude a Java memory leak because quantitative memory/CPU
  metrics are unavailable on the current Render Free instance. Alert delivery is
  NOT VERIFIED.
- `/api/sync` still has a large body/payload risk before validation because JSON
  is deserialized before Bean Validation list limits run.
- Task 2 local `npm run gate:secret-scan` is verified PASS after fixing the
  fallback path that scanned ignored local `.env` files when Node could not
  spawn Git. A GitHub Production Release Gate run for the exact candidate is
  still required before marking the release blocker closed.

## Audit Reconciliation Matrix

| Audit ID | Severity | Finding | Evidence code hiện tại | Evidence test hiện tại | Trạng thái | Gap còn lại | Hành động |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | High | Quiz/progress trusted client aggregates | `VocabularyService.recordQuizResult` resolves answers against current user's words and recomputes total/correct/wrong/score/combo/XP/achievements | `BackendHardeningTests` forged quiz tests, `mvnw test` PASS | VERIFIED_FIXED | No server-issued attempt/replay token | Track anti-replay only if product needs it |
| A-02 | High | Sync can overwrite server-managed stats/mastery | `SyncService.applyWordRequest` accepts content fields and calls `ensureStats` without applying incoming stats/mastered | `syncPayloadCannotOverwriteServerManagedProgressFields`, `mvnw test` PASS | VERIFIED_FIXED | Review local fallback can still diverge until cloud confirms | Keep documented local-first limitation |
| A-03 | High | CSRF disabled with cookie sessions | `SecurityConfig` enables Cookie CSRF, `/api/csrf`, restricted CORS headers, POST logout | `CsrfSecurityTests`, Playwright CSRF helper tests PASS | VERIFIED_FIXED | Real deployed OAuth browser flow not run here | Run staging/prod OAuth smoke before release |
| A-04 | High | Production migration defaults unsafe | `application-prod.yml`, Flyway migrations V1-V4, `ProductionDatabaseSafetyGuard` | `DatabaseSchemaTests`, `ProductionDatabaseSafetyGuardTests`, CI workflow | VERIFIED_FIXED | Production DB state not accessible from workspace | Validate staging/prod env and schema history |
| A-05 | High | No server-side delete/tombstone semantics | `SyncService`, `WordTombstone`, migrations V3/V4, `wordUid`, `deletions` | `SyncContractV2Tests`, Playwright tombstone/stale-device tests PASS | VERIFIED_FIXED | Tombstone garbage collection intentionally absent | Add retention policy only after real data age exists |
| A-06 | Medium | CORS allowed wildcard headers | `SecurityConfig.corsConfigurationSource` enumerates allowed origins/methods/headers | `CsrfSecurityTests` and source inspection | VERIFIED_FIXED | Env origins still must be exact in deployment | Gate validates `CORS_ALLOWED_ORIGINS` |
| A-07 | Medium | Security headers not explicit | `SecurityConfig` sets CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, and HTTPS-gated HSTS | `SecurityHeadersTests`, `SecurityHeadersHstsTests`, `CsrfSecurityTests` PASS | VERIFIED_FIXED | CSP still requires `unsafe-inline` until inline handlers are removed from static HTML | Remove inline handlers in a future frontend cleanup |
| A-08 | Medium | In-memory AI rate limiter | `AiRateLimitService` configurable minute/day per action/user, metrics on hit | `AiRateLimitTests`, `ObservabilityAndRateLimitTests` PASS | VERIFIED_FIXED | Not distributed; resets per JVM | Upgrade only for multi-instance/cost/abuse evidence |
| A-09 | Medium | Observability too thin | Request ID filter, MDC cleanup, request metrics, domain counters, actuator metrics | `ObservabilityAndRateLimitTests` PASS; Render screenshots confirm one OOM event and recovery | VERIFIED_FIXED for app instrumentation | Quantitative memory/CPU metrics unavailable on Free; alert delivery NOT VERIFIED | Upgrade instance or connect external observability/alerting, then verify delivered alert |
| A-10 | Medium | Frontend monolith/global state | Central `quizApiFetch` and sync helpers reduce API duplication | Playwright smoke PASS | PARTIALLY_FIXED | `app.js` remains large; no ES module split | Incremental modularization, not rewrite |
| A-11 | Medium | Backend God service | `SyncService` extracted; `VocabularyService` still owns CRUD/quiz/starter import | Backend tests PASS | PARTIALLY_FIXED | Quiz/CRUD/snapshot services not fully separated | Continue small service extraction |
| A-12 | Medium | Full scans/query bottlenecks | Some repository queries exist; normalized duplicate still streams user words | Backend tests PASS, no performance benchmark | PARTIALLY_FIXED | Review/analytics/snapshot pagination and query optimization incomplete | Add measured query work before scale |
| A-13 | Medium | API contract maturity/OpenAPI missing | `docs/API.md` documents current endpoints, CSRF, sync V2, errors | Docs/source inspection | PARTIALLY_FIXED | No generated OpenAPI contract tests | Add OpenAPI spec/generation |
| A-14 | Medium | Profile direct save underused | `PUT /api/profile` exists; backend validates ownership/profile/avatar input; frontend profile save/render path sanitizes cached avatar values | `ProfileSecurityTests`, profile Playwright smoke PASS | PARTIALLY_FIXED | Frontend still saves profile through local cache/full sync instead of direct `/api/profile` save | Consider direct profile save only as a focused API/UX batch |
| A-15 | Low | Misleading `[AUTH]` generic logs | `GlobalExceptionHandler` no longer uses old generic auth tag for all errors | Backend tests/log source inspection | VERIFIED_FIXED | Some auth-specific logs remain by design | No action |
| A-16 | Low | Unused archive/assets/dependencies | Archive documented as legacy; no removal requested | N/A | NOT_APPLICABLE | Search noise remains | Do not delete archive without explicit approval |
| A-17 | P0 gate | Release gate incomplete | Gate scripts and workflow exist | Gate report `NO-GO` | PARTIALLY_FIXED | Env/staging/restore evidence and clean tree missing | Complete external release checklist |
| A-18 | Testing | Missing forged/CSRF/tombstone tests | Tests now cover forged quiz, CSRF, Sync V2 tombstones, observability/rate limit | Historical backend and Playwright suite passes exist; exact counts need a fresh regression run before release notes quote them. | VERIFIED_FIXED | Load/performance and deployed OAuth E2E not run | Add after staging access |

## Status Counts

| Status | Count |
| --- | ---: |
| VERIFIED_FIXED | 12 |
| PARTIALLY_FIXED | 5 |
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

## Historical Tests Run 2026-07-31

These are historical local results. Task 6 did not rerun full backend or
Playwright regression, so do not use this table as a fresh test-count source.

| Command | Result | Evidence |
| --- | --- | --- |
| `backend\.mvnw.cmd test` | PASS | Historical local pass; exact count not reverified in Task 6 |
| `backend\.mvnw.cmd "-Dtest=SecurityHeadersTests,SecurityHeadersHstsTests,ProfileSecurityTests" test` | PASS | 7 SEC-01 backend tests, 0 failures |
| `backend\.mvnw.cmd clean package -DskipTests` | PASS | Jar built at `backend/target/quiz-0.0.1-SNAPSHOT.jar` |
| `node --check frontend\js\config.js` | PASS | Exit 0 |
| `node --check frontend\js\app.js` | PASS | Exit 0 after profile hardening |
| `node --check frontend\js\login.js` | PASS | Exit 0 |
| `node --check frontend\js\ai-explain.js` | PASS | Exit 0 |
| `node --check frontend\js\analytics-dashboard.js` | PASS | Exit 0 |
| `node --check frontend\js\review-today.js` | PASS | Exit 0 |
| `node --check frontend\js\storage.js` | PASS | Exit 0 after profile sanitizer |
| `node --check frontend\js\learning-studio.js` | PASS | Exit 0 after XSS/profile avatar cleanup |
| `npm run build:frontend` | PASS | `frontend-static-build` PASS |
| `npx playwright test --grep "profile save renders text safely"` | PASS | 1 profile save/render test |
| `npx playwright test` | PASS | Historical local pass; exact count not reverified in Task 6 |
| `npm run gate:secret-scan` | PASS | Task 2/Task 6 local PASS, `findingCount: 0` |
| `npm run gate:source-integrity` | NEEDS VERIFICATION | Must run on a clean release candidate; current docs/script evidence changes keep the tree dirty |
| `npm run gate:validate-env` | PASS WITH SAFE FIXTURE / NEEDS REAL ENV | Task 3 safe and invalid fixtures PASS; real production env validation still needs real env values |
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
| Security | 5 | 9 | CSRF, CORS headers, explicit CSP/referrer/HSTS tests, profile/avatar sanitizer, secret scan | Frontend CSP still allows inline handlers |
| Performance | 5 | 6 | Better sync consistency | Query optimization/pagination partial |
| Testing | 7 | 9 | 91 backend + 28 frontend tests | No load/staging OAuth E2E |
| DevOps | 6 | 8 | CI/gate scripts/Flyway guard | Gate NO-GO until env/evidence clean |
| Observability | 5 | 8 | Request ID/MDC/metrics/counters | No external APM |

Final verdict: `NOT_READY` for production release until external release-gate evidence is complete. Code-level hardening is substantially improved and suitable for staging validation.
