# Quality Upgrade Plan To 8.0

Date: 2026-08-08

Scope: current branch `chore/audit-reconciliation-and-upgrade`, source code,
docs, backend/frontend tests, GitHub workflows, Docker/config, package scripts,
Maven config, and release-gate scripts. This is an audit and action plan only;
no runtime code was changed for this document.

## Current Score Estimate

Estimated current quality/readiness score: `6.9/10` with a realistic range of
`6.7-7.1`.

This is not a blind reuse of the older `6.8/10` audit score. The source is now
materially stronger than the old 5.6/10 and early 6.8/10 findings:

- CSRF is enabled for cookie/session unsafe requests.
- Official quiz XP, stats, mastery, and achievements are computed server-side.
- Sync V2 uses `wordUid`, `expectedRevision`, tombstones, and a legacy ID bridge.
- Production profile pins Hibernate to `validate`, enables Flyway, disables
  Flyway clean, and rejects unsafe production DB config at startup.
- CI and the production release gate exist with backend, frontend, Flyway,
  security, observability, staging, and backup controls.
- Local verification immediately before this plan included backend tests,
  frontend static build, and Playwright passing on the previous refactor commit.

The score is still below 8.0 because production evidence, bounded resource
usage, large-account behavior, frontend architecture, visual regression, and
operations discipline are not strong enough yet. Code-hardening is closer to
8+, but production readiness remains closer to 6.2 until the external release
gate evidence is real.

## Why The Project Is Not Yet 8.0

The current source is a good beta foundation, not a production-grade operating
system. The biggest gaps are:

- A confirmed Render memory-limit restart has no root-cause classification.
- `/api/sync` validates list sizes after Jackson deserializes the full JSON body.
- Release gate status for the current commit has not been verified in GitHub
  Actions from this workspace.
- Staging smoke and restore rehearsal remain external evidence, not source facts.
- Public Actuator metrics are intentionally allowed by current gate/config, but
  docs also question whether public metrics should remain open.
- Review, analytics, sync, and snapshot flows still load large per-user lists.
- Frontend still relies on global script order and large files.
- Playwright smoke exists, but screenshot/visual regression is not yet a gate.
- Current docs are mostly reconciled, but a few files still contain historical
  statements or optimistic wording that can confuse release decisions.

## Blockers To Handle First

| Blocker | Status | Evidence | Required action |
| --- | --- | --- | --- |
| Render memory-limit restart | OPEN | Current docs record a confirmed Render memory-limit restart, but source cannot identify leak vs payload spike vs instance headroom. | Capture Render Metrics around the incident, correlate request/log evidence, set a tested JVM/RSS budget, and add alert thresholds. |
| `/api/sync` pre-deserialization payload cap | OPEN | `SyncRequest` has `@Size(max=5000)` list limits, but Spring/Jackson must parse the body first. | Add request-body cap at container/filter/proxy level, add oversized-body tests, then design chunk/delta sync. |
| Release gate secret scan | OPEN / NEEDS VERIFICATION | Current `secret-scan.mjs` scans git candidate files and avoids ignored files, but prior local gate issue must be verified on the clean release candidate. | Run `npm run gate:secret-scan` and GitHub Production Release Gate on the exact candidate; add scanner fixtures for empty env placeholders. |
| GitHub Actions for current commit | NEEDS VERIFICATION | Workflows exist, but this audit did not query remote run status. | Check CI and Production Release Gate status for the pushed commit SHA before release. |
| Staging smoke | BLOCKED / NEEDS VERIFICATION | `staging-smoke.mjs` blocks without `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`; OAuth browser callback still needs real browser credential evidence. | Configure staging secrets, run smoke, and store artifact. |
| Restore/backup rehearsal | BLOCKED / NEEDS VERIFICATION | Gate requires `docs/restore-rehearsal-evidence.md` or `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`; no current evidence file exists. | Perform non-production restore rehearsal and record safe evidence. |

## Priority Table

| Rank | Difficulty | Impact | Area | Weakness | Why it matters | Recommended fix | Verification | Expected score gain |
| ---: | ---------- | ------ | ---- | -------- | -------------- | --------------- | ------------ | ------------------: |
| 1 | Easy | High | CI/CD/release gate | GitHub Actions status for the current commit is not verified. | A local pass is not a release signal. | Check CI and Production Release Gate for the exact commit SHA; link artifacts in release notes. | GitHub checks show PASS or documented BLOCKED controls for same SHA. | 0.15 |
| 2 | Easy | High | CI/CD/release gate | Secret scan release blocker needs a clean candidate run. | A false-positive or missed real secret blocks safe release. | Run `npm run gate:secret-scan` on a clean tree and GitHub gate; add fixture tests if it flags empty env placeholders again. | Clean scan artifact; no tracked `.env` or secret-like files. | 0.20 |
| 3 | Easy | High | Deployment/production operations | Staging smoke is configured as a gate but not evidenced. | Production confidence needs real deployed URL behavior, not only local mocks. | Configure staging URLs/test hint and run `npm run gate:staging-smoke`; add manual OAuth login/logout evidence. | Staging smoke PASS plus OAuth browser notes. | 0.25 |
| 4 | Easy | High | Deployment/production operations | Restore rehearsal evidence is missing. | Backups are unproven until restore is rehearsed. | Restore a non-production backup, verify app startup/health, and create `docs/restore-rehearsal-evidence.md` without raw data. | `gate:backup-rollback` PASS. | 0.30 |
| 5 | Easy | High | Observability/monitoring | Render memory incident lacks root-cause data. | Repeated restarts can erase trust and hide real leaks or spikes. | Export Render Metrics around the incident, record RAM/CPU/request trend, and classify leak/spike/headroom. | Incident note with metrics timestamps and conclusion. | 0.25 |
| 6 | Easy | High | Observability/monitoring | Alerting rules are documented only, not connected. | Metrics without alerts do not protect uptime. | Add Render or external alert thresholds for health, 5xx, RAM 75/90%, AI failures, sync conflicts. | Alert config screenshot/export plus test notification. | 0.20 |
| 7 | Easy | High | Documentation/product readiness | Docs contain stale counts and a metrics exposure contradiction. | Release decisions get muddy when docs disagree with source. | Update non-archive docs: latest 98/29 test counts where appropriate, clarify `metrics` exposure policy, mark historical schema docs as historical where stale. | `rg` confirms no current doc says only health/info exposed while config exposes metrics. | 0.10 |
| 8 | Medium | Critical | Security | `/api/sync` lacks body-size cap before deserialization. | A large JSON body can spike memory before Bean Validation runs. | Add Spring/Tomcat/proxy max request size for sync, reject early with 413, document limits. | MockMvc/container test for oversized body and local memory smoke. | 0.45 |
| 9 | Medium | High | Database/performance | Review queue loads all user words then filters/sorts in Java. | Large accounts will burn memory/CPU and slow due review. | Add repository query by `nextReview <= now`, optional tag/level, ordered priority, bounded limit. | Repository/service tests plus query plan on PostgreSQL. | 0.25 |
| 10 | Medium | High | Database/performance | Analytics loads words/history repeatedly and aggregates in memory. | Analytics can become slow and amplify memory pressure. | Load per request once, add bounded history windows or SQL aggregates for overview/trend/tag metrics. | Backend analytics tests and benchmark with seeded large account. | 0.25 |
| 11 | Medium | High | Sync/offline behavior | Snapshot and sync return full vocab, wrong bank, tombstones, and recent history. | Full snapshots do not scale and keep tombstones unbounded. | Design delta sync by revision with page limits and client acknowledgement for tombstones. | Contract tests for delta pages, stale clients, and tombstone retention. | 0.35 |
| 12 | Medium | High | CI/CD/release gate | Production gate is not tied to deployment. | A deploy can happen without the GO artifact. | Make deployment workflow depend on a GO report for the same SHA or document manual approval gate with artifact link. | Release workflow refuses deploy without matching GO. | 0.20 |
| 13 | Medium | High | Testing/QA | Playwright smoke is not visual regression. | CSS refactors can pass smoke while damaging layout/readability. | Add screenshot baselines for dashboard, quiz, vocabulary, analytics, studio, mobile widths. | `toHaveScreenshot` or equivalent artifact comparison in CI. | 0.25 |
| 14 | Medium | High | Security | CSP still requires `unsafe-inline`. | Inline handlers keep XSS blast radius larger than necessary. | Move inline handlers in `index.html` to JS event listeners incrementally; tighten CSP after coverage. | Security header tests update; Playwright flows still pass. | 0.20 |
| 15 | Medium | Medium | Security | Public `/actuator/metrics/**` is allowed by `SecurityConfig` and required by gate defaults. | Public metrics may reveal operational shape; locking it down may break current ops visibility. | Decide policy: keep public intentionally with reviewed endpoint list, or protect metrics behind monitoring/auth and update gate. | Security tests and release gate agree with chosen policy. | 0.15 |
| 16 | Medium | Medium | Backend architecture | `VocabularyService` still owns CRUD, starter import, quiz result, and snapshot delegation. | Broad services make changes harder to reason about and test. | Extract quiz result processor and starter import use case first; keep controller/API unchanged. | Existing backend tests plus focused service tests pass. | 0.15 |
| 17 | Medium | Medium | Backend architecture | `CurrentUserService.requireUser()` updates activity during normal auth lookup. | Read endpoints create writes and can add DB pressure. | Split read-only current user lookup from rate-limited activity touch. | Backend auth/profile tests and simple request-count/write behavior test. | 0.15 |
| 18 | Medium | Medium | Testing/QA | No generated OpenAPI or machine-checked API contract. | Docs can drift from endpoints and frontend expectations. | Add OpenAPI generation or checked contract snapshots for core API, CSRF, sync V2, errors. | Contract generation/check in CI. | 0.20 |
| 19 | Medium | Medium | Database/performance | Normalized duplicate English is enforced in service scans, not a DB constraint. | External/manual data changes can reintroduce duplicates; service scans are slow. | Audit production duplicates, then add generated normalized key or unique index if clean. | Read-only Supabase duplicate audit and migration rehearsal. | 0.15 |
| 20 | Medium | Medium | Sync/offline behavior | Local-first stats can diverge offline until cloud confirms official stats. | Users may see temporary differences between local and cloud progress. | Document UI distinction clearly and consider displaying official-cloud vs local fallback status. | Playwright local/offline/auth smoke. | 0.10 |
| 21 | Hard | High | Frontend architecture | `frontend/js/app.js` remains a large global-script module. | Auth, sync, profile, dashboard, import/export coupling makes safe changes slow. | Extract by global-compatible namespaces first; avoid framework rewrite. | Node syntax checks, Playwright full smoke, load-order tests. | 0.25 |
| 22 | Hard | High | Frontend architecture | `frontend/js/learning-studio.js` mixes profile/history/decks/CSV/focus/AI deck. | Studio changes carry high regression risk. | Split into focused global-compatible files or a tiny internal module registry. | Playwright studio, AI deck, CSV/import tests. | 0.20 |
| 23 | Hard | Medium | Frontend architecture | `frontend/css/modern.css` core remains 4,428 lines by newline count; `design-system.css` is large and not loaded. | CSS ownership is unclear and visual regressions are likely. | Continue domain splits only with screenshot regression; audit unused selectors before deleting. | Static build, smoke, screenshot tests. | 0.15 |
| 24 | Hard | Medium | Testing/QA | `tests/smoke.spec.js` is a 1,050-line all-in-one suite. | Test helpers and sync fixtures are hard to reuse and review. | Split helpers/fixtures and specs by feature. | Same 29 Playwright tests pass with no behavior changes. | 0.10 |
| 25 | Hard | Medium | Deployment/production operations | JVM/RSS memory budget is not codified. | Render free/low-memory instances can restart without app-level OOM. | Test `JAVA_TOOL_OPTIONS` in staging, set heap/metaspace/thread budget, document rollback. | Staging boot/load smoke and metrics before/after. | 0.20 |
| 26 | Hard | Medium | Observability/monitoring | No external APM/error tracker is configured. | Request IDs and metrics help only after someone inspects them. | Add Sentry/OpenTelemetry/host alerts when traffic justifies it; keep secrets server-side. | Error test event and dashboard link in release evidence. | 0.15 |
| 27 | Very Hard | High | Sync/offline behavior | No large-account sync/load benchmark exists. | Architectural choices are guesswork without payload and memory measurements. | Create seeded large account benchmark for sync, snapshot, review, analytics. | CI/manual benchmark report with max payload/RSS/p95 latency. | 0.25 |
| 28 | Very Hard | Medium | Backend architecture | AI rate limiting is process-local. | It is not a global quota if backend scales horizontally. | Add Redis/distributed limiter only when multi-instance, abuse, or cost evidence exists. | Multi-instance integration test. | 0.10 |
| 29 | Very Hard | Low | Frontend architecture | Full framework/bundler migration is tempting. | It can consume scope while delaying production blockers. | Defer until runtime risk is lower and visual/API contracts are locked. | Separate RFC and migration branch only. | 0.05 |

## Weaknesses By Area

### Security

- OPEN: `/api/sync` needs a hard request body-size cap before JSON
  deserialization.
- OPEN: Public `/actuator/metrics/**` is currently permitted in
  `SecurityConfig`; release gate currently expects metrics exposed. Decide and
  align docs, tests, and gate.
- PARTIAL: CSP still allows `unsafe-inline` because `index.html` uses inline
  event handlers and static global scripts.
- NEEDS VERIFICATION: secret scan must pass on the clean release candidate and
  must not scan ignored local `.env` files or flag empty env placeholders.
- ACCEPTED LIMITATION: AI limiter is in-memory and suitable only for the current
  single-instance assumption.

### Backend Architecture

- `VocabularyService` remains broad even after `SyncService` extraction.
- `CurrentUserService.requireUser()` combines identity lookup with activity
  update/write behavior.
- `LearningAnalyticsService` and `SpacedRepetitionService` use service-layer
  streaming for work that should become repository/SQL bounded as data grows.
- No generated OpenAPI contract exists.

### Frontend Architecture

- `app.js` and `learning-studio.js` remain large global-script modules.
- `index.html` still has inline event handlers and depends on exact script
  order.
- `modern.css` was partially split, but the core stylesheet remains large and
  visually risky.
- `design-system.css` is large and appears not to be loaded by `index.html`;
  selector usage needs audit before removal or split.

### Database/Performance

- Full user vocabulary/history/tombstone loads remain common.
- Duplicate English enforcement uses service scans rather than a normalized DB
  key.
- Production schema drift and Flyway baseline state require external Supabase
  verification.
- No large-account benchmark documents payload size, query count, latency, or
  memory.

### Sync/Offline Behavior

- Sync V2 is much safer than the old contract, but payload size and full
  snapshots still limit scale.
- Tombstones are retained conservatively; retention/ack policy is future work.
- Local-first progress can temporarily diverge from official cloud state.
- Frontend sync state remains complex and coupled to localStorage, global data,
  and UI status.

### Testing/QA

- Backend and Playwright coverage is strong for security/sync smoke.
- No load/performance tests for sync, review, analytics, or snapshot.
- No screenshot/visual regression gate.
- Deployed OAuth browser flow is not proven by local tests.
- `tests/smoke.spec.js` should be split after keeping the suite green.

### CI/CD/Release Gate

- CI workflow exists and is meaningful, but current remote status must be
  verified per commit.
- Production Release Gate exists but is not a deployment workflow.
- Staging smoke and restore rehearsal can be `BLOCKED` without external setup.
- Gate currently treats `metrics` as required, which conflicts with the audit
  question of whether public metrics should remain open.

### Deployment/Production Operations

- No `render.yaml` or `vercel.json` is present, so host config is manual.
- Render memory incident needs metrics-backed classification.
- JVM/RSS budget is not codified in deployment config.
- Restore evidence is not present in repo.
- Runbooks are good, but operational proof is incomplete.

### Observability/Monitoring

- Request IDs, MDC, Micrometer, Actuator, and counters exist.
- External alerting/APM is documented only, not integrated.
- Metrics are public by current source; protection/intent needs a decision.
- Render Metrics around the incident are still external and unverified.

### Documentation/Product Readiness

- Current docs mostly supersede old audit findings correctly.
- Current contradictions to fix:
  - `docs/deploy.md` says only `health` and `info` are exposed, while source
    and config expose `metrics`.
  - Some verification docs still mention older 91/28 test counts while recent
    local runs are 98 backend tests and 29 Playwright tests.
  - Historical schema/audit docs outside archive still contain stale statements
    such as old Flyway readiness language; mark them historical or update their
    status banner.
- Product docs are useful but lighter than the implemented app; keep them as
  product notes, not release evidence.

## Tasks From Easy To Hard

1. Verify GitHub Actions status for the current pushed commit.
2. Run clean `gate:secret-scan`; add scanner fixtures if needed.
3. Configure and run staging smoke.
4. Add restore rehearsal evidence.
5. Capture Render memory metrics and classify incident.
6. Align docs and release gate on Actuator metrics exposure policy.
7. Refresh stale test counts and historical status banners in current docs.
8. Add pre-deserialization body cap for `/api/sync`.
9. Add repository-bounded review queue query.
10. Reduce repeated analytics loads and add bounded history windows.
11. Add screenshot regression baselines.
12. Add generated OpenAPI or checked contract spec.
13. Benchmark seeded large-account sync/review/analytics.
14. Extract `VocabularyService` responsibilities.
15. Extract frontend `app.js` and `learning-studio.js` incrementally.
16. Design delta sync and tombstone acknowledgement.
17. Add external alerting/APM.
18. Consider distributed AI rate limiting only after scale evidence.

## Highest Impact Fast Wins

- Verify GitHub Actions and release-gate status for the exact commit.
- Close secret-scan, staging-smoke, and restore-rehearsal gate blockers.
- Capture Render Metrics and add alert thresholds.
- Add `/api/sync` request body cap.
- Decide and align public metrics exposure.
- Add screenshot regression for current UI before further CSS/HTML refactors.

## Do Not Do Too Early

- Do not rewrite the frontend into React/Vue or a bundler before release
  blockers and screenshot baselines are closed.
- Do not add Redis/distributed rate limiting until multi-instance or abuse/cost
  evidence exists.
- Do not delete tombstones without an acknowledgement/retention design.
- Do not add a normalized unique vocabulary index before production duplicate
  audit and cleanup.
- Do not remove archive/history docs merely to reduce line count.
- Do not combine CSS cleanup with learning-flow or sync behavior changes.
- Do not treat upgrading Render plan as the root-cause fix until metrics prove
  the issue is simple headroom.

## Roadmap To 8.0

### Phase 1: Easy, Low-Risk, Fast Score Gain

Goal: raise confidence by proving the current release candidate, not by changing
behavior.

- Verify CI and Production Release Gate for the current commit SHA.
- Run clean `gate:secret-scan` and fix scanner fixtures if needed.
- Configure staging smoke variables and run staging smoke.
- Perform non-production restore rehearsal and record evidence.
- Capture Render memory metrics and classify the restart.
- Update current docs to remove stale test counts and metrics exposure
  contradictions.

Expected score after Phase 1: about `7.3/10`.

### Phase 2: Security, Performance, And Release Hardening

Goal: close the issues most likely to break production under small public beta
load.

- Add pre-deserialization body-size cap for `/api/sync`.
- Add request/payload tests and a documented sync payload budget.
- Decide public metrics policy and align `SecurityConfig`, env gate, and docs.
- Add JVM/RSS budget and memory alerts in staging.
- Add repository-bounded review query and reduce analytics repeated list loads.
- Add OpenAPI/contract checks for core API and Sync V2.

Expected score after Phase 2: about `7.7/10`.

### Phase 3: Frontend And Backend Refactor Discipline

Goal: reduce regression cost without changing product behavior.

- Split `app.js` by auth/session, sync/delete queue, profile/dashboard, and
  import/export while preserving global compatibility.
- Split `learning-studio.js` by decks, AI deck, CSV, focus, and profile/history.
- Continue `modern.css` split only with screenshot regression.
- Split `tests/smoke.spec.js` helpers and specs by feature.
- Extract backend quiz result processing and starter import use cases from
  `VocabularyService`.

Expected score after Phase 3: about `7.9/10`.

### Phase 4: Production Operations, Monitoring, Backup, Staging Discipline

Goal: make production readiness repeatable.

- Make deployment depend on a GO release-gate artifact for the same SHA.
- Add external alert routing and incident runbook links.
- Add large-account benchmark reports to release evidence.
- Rehearse Supabase schema/Flyway baseline on a copy before production.
- Add post-deploy authenticated OAuth smoke discipline.

Expected score after Phase 4: `8.0/10` if Phases 1-3 are also complete and
verified.

## Production-Ready Minimum Bar

Do not call the project production-ready until all of these are true:

- Render memory incident is classified and monitored.
- `/api/sync` rejects oversized bodies before deserialization.
- CI and Production Release Gate pass for the exact release commit.
- Secret scan, source integrity, staging smoke, and backup/restore controls are
  PASS or have real, documented external evidence.
- Production env validation passes with real values and no printed secrets.
- Staging OAuth login/logout, vocabulary add/delete, sync, review, analytics,
  and AI fallback/rate-limit smoke pass.
- Production database backup and non-production restore rehearsal are recorded.
- Actuator metrics exposure policy is explicit and tested.
- Visual regression baseline exists before further UI/CSS churn.

## Needs Verification

- Render Metrics around the 2026-08-07 memory-limit restart.
- GitHub Actions status for commit `98120bd2ec78910fb1b4b5cee9d0e2ed499c7792`
  and any later release candidate.
- Production Release Gate result on a clean candidate.
- Staging smoke with real staging URLs and test identity.
- Google OAuth browser flow in staging/production.
- Restore rehearsal on a non-production database.
- Production Supabase schema drift, duplicate vocabulary, orphan rows, and
  Flyway history state.
- Large-account memory/latency behavior for sync, snapshot, review, and
  analytics.
