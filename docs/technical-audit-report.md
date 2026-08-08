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
| P0-01 | NEW / OPEN | Render memory-limit restart | The incident is confirmed as a Render memory-limit restart, but source/log evidence is not enough to conclude a Java memory leak. A 512 MB free instance has limited headroom for Spring Boot, JPA, Security, Flyway, and Actuator. | Capture Render Metrics around the incident window, correlate RAM/CPU/request volume/log request IDs, set a tested JVM/RAM budget in staging, and add alert thresholds. |
| P0-02 | NEW / OPEN | `/api/sync` large body risk | `SyncRequest` limits list lengths after request deserialization. There is no source-level hard request-body cap before Jackson parses the JSON body, and sync still accepts legacy `wrongWords`, so a large payload can cause a memory spike before validation. | Add a container/Spring request-size limit, shrink/chunk full sync payloads, remove or phase out legacy `wrongWords`, and add oversized-body regression tests. |
| P0-03 | PARTIALLY RESOLVED / VERIFY | Production gate secret scan false positive | The 2026-08-08 audit reported a false positive caused by matching empty env keys across lines. Current `secret-scan.mjs` uses newline-safe whitespace around assignments, which appears to address the bug, but a clean production release-gate run is still required before this can be marked resolved. | Run `npm run gate:secret-scan` and the GitHub Production Release Gate on a clean candidate. If it still flags empty env placeholders, fix the scanner and add fixture coverage. |
| P0-04 | OPEN | Release evidence incomplete | Production readiness still depends on environment, staging, backup/restore, and source-integrity evidence that cannot be inferred from source alone. | Verify Render/Supabase/Google OAuth settings, GitHub Actions status, staging smoke, and restore rehearsal evidence. |

## Reconciled Findings

| Finding | Current status | Notes |
| --- | --- | --- |
| CSRF disabled with cookie sessions | RESOLVED | `SecurityConfig` enables Cookie CSRF, `/api/csrf`, JSON `403`, and CSRF-protected POST logout. |
| Client can forge XP/progress through `/api/quiz-results` | RESOLVED | `VocabularyService.recordQuizResult` resolves answers against current user's words and recomputes total, correct, score, combo, XP, stats, and achievements. |
| Client sync can overwrite official XP/stat/mastery | RESOLVED | `SyncService` applies editable word fields and ensures stats exist; it does not apply incoming stats/mastered as official progress. |
| Sync has no tombstone/delete contract | RESOLVED | Sync V2 requires `syncContractVersion: 2`, `expectedRevision`, stable `wordUid`, `deletions`, and tombstone-aware snapshots. |
| Production `ddl-auto=update` / Flyway disabled | OBSOLETE for prod, still local default | Default local H2 keeps `ddl-auto=update` and Flyway off. Production profile pins `ddl-auto=validate`, Flyway enabled, and fail-fast safety guard. |
| CORS wildcard headers/origins | RESOLVED in code | `SecurityConfig` uses configured origins and explicit headers. Deployment env still must be exact. |
| Observability too thin | PARTIALLY RESOLVED | Request ID, MDC, health counters, Actuator metrics, and gate tests exist. External APM/alerts and Render incident metrics are still absent. |
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

- Render Metrics around the memory incident and JVM/RSS baseline after boot.
- GitHub Actions status for the exact pushed commit.
- Backend tests in this workspace with Maven/network available.
- Playwright pass in an environment with browser binaries installed.
- Production release gate secret scan on a clean tree.
- Staging OAuth login/logout smoke and restore rehearsal evidence.

## Refactor Candidates

Do not split code in this docs-only task. Candidates over about 1000 lines:

| File | Lines | Risk |
| --- | ---: | --- |
| `frontend/css/modern.css` | 5484 | Large cascade; visual regression risk. |
| `frontend/js/app.js` | 1833 | Auth, sync, profile, import/export, dashboard wrappers coupled through globals. |
| `frontend/css/design-system.css` | 1576 | Large stylesheet; verify whether every selector is active before cleanup. |
| `frontend/js/learning-studio.js` | 1460 | Studio, decks, CSV, AI deck, focus, and profile/history logic are coupled. |
| `tests/smoke.spec.js` | 1050 | Test file can be split by feature after current docs work. |

## Historical Inputs

- Original 2026-07-30 audit: `docs/archive/technical-audit-report-2026-07-30-original.md`.
- Duplicate 2026-08-08 audit inputs:
  - `docs/archive/quiz-app-audit-report-2026-08-08-source.md`
  - `docs/archive/quiz-app-audit-report-2026-08-08-duplicate.md`
