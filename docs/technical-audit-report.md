# Current Technical Audit - Quiz App / WordArena

Date: 2026-08-08

Scope: current repository source, docs, configs, release-gate scripts, backend
tests, frontend smoke tests, Flyway migrations, and the two duplicate 2026-08-08
audit inputs now archived under `docs/archive/`.

## Executive Summary

The old `5.6/10` production-readiness conclusion is obsolete for the current
source. The code now includes major hardening: CSRF is enabled for session auth,
official quiz XP/statistics are recomputed server-side, Sync Contract V2 uses
stable `wordUid`, revision checks, tombstones, and a legacy-ID bridge, production
profile uses Flyway with Hibernate `ddl-auto=validate`, and observability has
request IDs, health counters, Micrometer metrics, and release-gate controls.

This does not mean the app is production-ready. Current assessment:

- Code hardening posture: about `8.4/10`.
- Production readiness: about `6.2/10`.
- Release decision: `NO-GO` for a production-ready claim; `conditional beta`
  after the open P0 operational blockers below are closed and verified.

## Current Blockers

| ID | Status | Finding | Source-based assessment | Required verification/action |
| --- | --- | --- | --- | --- |
| P0-01 | CONFIRMED / OPEN | Render memory-limit restart | Render Events confirms one memory failure on August 7, 2026 at 11:18 PM (`used over 512MB`) and recovery at 11:23 PM. Source/log evidence is still not enough to conclude a Java memory leak, and Render Free does not expose quantitative application memory/CPU metrics. | Upgrade the instance or connect external observability/alerting, capture RAM/CPU/request volume/log request IDs, set a tested JVM/RAM budget in staging, and verify alert delivery. |
| P0-02 | NEW / OPEN | `/api/sync` large body risk | `SyncRequest` limits list lengths after request deserialization. There is no source-level hard request-body cap before Jackson parses the JSON body, and sync still accepts legacy `wrongWords`, so a large payload can cause a memory spike before validation. | Add a container/Spring request-size limit, shrink/chunk full sync payloads, remove or phase out legacy `wrongWords`, and add oversized-body regression tests. |
| P0-03 | LOCALLY RESOLVED / GITHUB GATE VERIFY | Production gate secret scan fallback false positive | Task 2 local `npm run gate:secret-scan` is verified PASS after a narrow fix: when Node cannot spawn Git and the script falls back to filesystem walking, ignored local `.env` files are skipped. The preferred scan path remains `git ls-files --cached --others --exclude-standard`, and no tracked secret was confirmed. | Run the GitHub Production Release Gate on a clean candidate and review the artifact for the exact SHA before marking the release blocker closed. |
| P0-04 | OPEN | Release evidence incomplete | Production readiness still depends on clean source-integrity, staging smoke, backup/restore, Render/Supabase/Google OAuth, and release-gate evidence that cannot be inferred from source alone. | Verify Production Release Gate for the exact candidate, staging smoke env, restore rehearsal evidence, and deployment provider settings. |

## Reconciled Findings

| Finding | Current status | Notes |
| --- | --- | --- |
| CSRF disabled with cookie sessions | RESOLVED | `SecurityConfig` enables Cookie CSRF, `/api/csrf`, JSON `403`, and CSRF-protected POST logout. |
| Client can forge XP/progress through `/api/quiz-results` | RESOLVED | `VocabularyService.recordQuizResult` resolves answers against current user's words and recomputes total, correct, score, combo, XP, stats, and achievements. |
| Client sync can overwrite official XP/stat/mastery | RESOLVED | `SyncService` applies editable word fields and ensures stats exist; it does not apply incoming stats/mastered as official progress. |
| Sync has no tombstone/delete contract | RESOLVED | Sync V2 requires `syncContractVersion: 2`, `expectedRevision`, stable `wordUid`, `deletions`, and tombstone-aware snapshots. |
| Production `ddl-auto=update` / Flyway disabled | OBSOLETE for prod, still local default | Default local H2 keeps `ddl-auto=update` and Flyway off. Production profile pins `ddl-auto=validate`, Flyway enabled, and fail-fast safety guard. |
| CORS wildcard headers/origins | RESOLVED in code | `SecurityConfig` uses configured origins and explicit headers. Deployment env still must be exact. |
| Observability too thin | PARTIALLY RESOLVED | Request ID, MDC, health counters, Actuator metrics, and gate tests exist. Render screenshots confirm the OOM/recovery events, but quantitative memory/CPU metrics are unavailable on Free and alert delivery is not verified. |
| In-memory AI rate limiter | PARTIALLY RESOLVED | Configurable per-user limiter exists and is acceptable for one backend instance. It is not distributed and should not be used as a multi-instance guarantee. |
| Public `/actuator/metrics/**` | OPEN | Public metrics are currently permitted. Keep only if intentional for the deployment model; otherwise protect or restrict to monitoring. |
| Frontend monolith/global state | OPEN | `frontend/js/app.js` and `learning-studio.js` remain large global-script modules. |
| Backend god service | PARTIALLY RESOLVED | `SyncService` was extracted; `VocabularyService` still owns CRUD, quiz result, starter import, and snapshot delegation. |
| Full-list sync/review/analytics scans | OPEN | Several paths still load all user words/history and filter in memory. |
| Missing OpenAPI/contract spec | OPEN | `docs/API.md` documents important contracts, but there is no generated OpenAPI spec or schema test. |
| Tombstone cleanup absent | OPEN by design | Tombstones are retained to prevent stale-device resurrection; retention/ack policy is future work. |
| Old audit score and blocker text | OBSOLETE | Historical copies are archived; this file is the current audit entry point. |

## Source Evidence Checked

- Backend configs: `backend/pom.xml`, `backend/Dockerfile`, `application.properties`, `application.yml`, `application-prod.yml`, OAuth profile config.
- Security/auth: `SecurityConfig`, `CsrfController`, `AuthController`, `CurrentUserService`, security/header tests.
- Sync/data: `SyncRequest`, `SyncService`, `VocabularyService`, tombstone entities/repositories, Flyway V1-V4.
- Business integrity: quiz result DTOs/services/tests, review service, analytics service.
- Operations: `.github/workflows/ci.yml`, `.github/workflows/production-release-gate.yml`, release-gate scripts.
- Frontend: `config.js`, `app.js`, `vocab.js`, `quiz.js`, `review-today.js`, `analytics-dashboard.js`, `ai-explain.js`, `learning-studio.js`, Playwright smoke tests.

## Verification Still Needed

- Quantitative memory/CPU metrics around the confirmed Render memory incident,
  JVM/RSS baseline after boot, and alert delivery evidence.
- GitHub Production Release Gate status and artifact for the exact pushed
  release candidate.
- Full backend/frontend regression counts from a fresh run, if the release note
  needs exact test numbers.
- Source-integrity on a clean release candidate.
- Staging OAuth login/logout smoke, staging smoke env, and restore rehearsal
  evidence.

## Refactor Candidates

Do not split code in this docs-only task. Candidates over about 1000 lines:

| File | Lines | Risk |
| --- | ---: | --- |
| `frontend/css/modern.css` | 4428 | PARTIALLY RESOLVED: light-theme and responsive tails moved to `modern-theme-light.css` and `modern-responsive.css`; core cascade remains large. |
| `frontend/js/app.js` | 1833 | Auth, sync, profile, import/export, dashboard wrappers coupled through globals. |
| Runtime CSS ownership | Covered by `npm run test:assets` | Every `frontend/css/*.css` file must be linked or imported by the runtime stylesheet graph. |
| `frontend/js/learning-studio.js` | 1460 | Studio, decks, CSV, AI deck, focus, and profile/history logic are coupled. |
| `frontend/index.html` | 1212 | Static app shell is large; fragmenting it would require a template/build step and may change delivery semantics. |
| `tests/smoke.spec.js` | 1050 | Test file can be split by feature after current docs work. |

## Historical Inputs

- Original 2026-07-30 audit: `docs/archive/technical-audit-report-2026-07-30-original.md`.
- Duplicate 2026-08-08 audit inputs:
  - `docs/archive/quiz-app-audit-report-2026-08-08-source.md`
  - `docs/archive/quiz-app-audit-report-2026-08-08-duplicate.md`
