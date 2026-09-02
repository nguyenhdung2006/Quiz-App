# Testing

## Finding 12 Batch 12D Retention Verification (2026-09-03)

The Batch 12D candidate was verified before commit without deployment or
access to cloud/production databases:

- focused retention, quiz/review replay, spaced-repetition, Findings 5–9, and
  H2 schema suites: **61/61 PASS**;
- `cd backend; .\mvnw.cmd clean verify`: **169/169 PASS** in 29 suites, with
  zero failures, errors, or skips;
- `cd backend; .\mvnw.cmd -DskipTests package`: **PASS**;
- JaCoCo: **88.57% lines** (2704/3053), **63.34% branches** (781/1233);
- focused Finding 12 Chromium: **13/13 PASS**; no production frontend file was
  changed by 12D;
- disposable local PostgreSQL 16.14 fresh Flyway V1→V8 plus Hibernate
  validation: **PASS**; restart at V8, eight-migration Flyway validation, and
  Hibernate validation: **PASS**;
- docs drift, secret scan, and `git diff --check`: **PASS**.

Deterministic retention tests use an injected clock and prove the strict-old
boundary: equality at seven days is retained and only an older timestamp is
eligible. They also cover the 24-hour issued-attempt lifetime plus seven-day
expiry grace, oldest-first bounded batches, attempt-item cascade, quiz-history
retention, cross-owner maintenance, cleanup failure isolation, concurrent
normal review, and post-cleanup fail-closed quiz/Review Today behavior.

The PostgreSQL sanity fixture used 501 rows per ledger category. A single pass
selected/deleted 500 IDs per category, cascaded 1,000 attempt items, retained
all 501 quiz histories, and left one eligible row per category for a later
pass. Deletion statements completed in 0.940–3.068 ms and the bounded consumed
ID selection in 0.297 ms on that local fixture. These timings are diagnostic,
not a production capacity claim.

The latest migration exercised by these checks is
`V8__add_retention_cleanup_indexes.sql`.

## Audit Findings 5-9 Verification (2026-08-24)

Verified against the uncommitted bounded findings 5-9 working tree:

- `cd backend; .\mvnw.cmd test`: PASS, 118/118 tests.
- `cd backend; .\mvnw.cmd verify`: PASS, 118/118 tests; JaCoCo line
  coverage 88.76% (2329/2624), above the 80% gate.
- Focused backend findings/review/sync regression: PASS, 20/20 tests.
- `npx playwright test --project=chromium`: PASS, 72/72 tests.
- Focused Playwright findings 5-9 regression: PASS, 6/6 tests.
- Frontend syntax, ESLint, static build, CSS assets, inline-style ratchet,
  import/session/sync-status helpers, docs drift, and secret scan: PASS.
- `git diff --check`: PASS.
- `gate:source-integrity`: expected `BLOCKED` because the implementation is
  intentionally uncommitted for review and the three supplied audit artifacts
  remain intentionally untracked.

An initial full Chromium run had one pre-existing login-navigation timeout
while Maven ran concurrently; that test passed immediately in isolation and
the subsequent non-concurrent full run passed 72/72.

## Historical Verified Baselines

Run on 2026-07-31 from this workspace. Task 6 did not rerun full backend or
Playwright regression, so exact test counts below must be refreshed before they
are used in release notes:

- `backend`: `.\mvnw.cmd test` passed in the historical run.
- `backend`: `.\mvnw.cmd clean package -DskipTests` passed.
- `frontend`: `npx playwright test` passed in the historical run.
- `frontend`: requested `node --check` commands for `config.js`, `app.js`, `login.js`, `ai-explain.js`, `analytics-dashboard.js`, and `review-today.js` passed.
- `npm run build:frontend` passed.
- `npm run gate:secret-scan` passed after the scanner kept the
  commit-candidate path and fixed fallback walking so ignored local `.env` files
  are not scanned when Git listing is unavailable.
- `npm run gate:report` is expected to conclude `NO-GO` until source integrity
  runs on a clean candidate, real production env validation is available,
  restore rehearsal evidence exists, and staging smoke variables are configured.

## Historical Baseline Before CSRF Change

- `backend`: `.\mvnw.cmd test` passed with 57 tests.
- `backend`: `.\mvnw.cmd clean package -DskipTests` passed.
- `frontend`: `npm run test:frontend` passed with 24 Playwright tests.
- Frontend build script is not defined in `package.json`.
- Real Google OAuth browser E2E was not run in this local audit.

## CSRF Verification

Backend CSRF behavior is covered by `backend/src/test/java/com/quizapp/CsrfSecurityTests.java`:

- `GET /api/csrf` issues token JSON and `XSRF-TOKEN` cookie.
- Missing CSRF on unsafe API calls returns `403` JSON.
- Invalid CSRF on unsafe API calls returns `403` JSON.
- Valid CSRF allows authenticated unsafe writes.
- A valid CSRF token does not authenticate anonymous unsafe requests.
- Safe GET endpoints do not require CSRF.
- OAuth2 authorization GET is not blocked by CSRF.
- Logout requires CSRF and returns `204` when valid.
- CORS preflight allows configured origins and rejects an unknown origin.

Frontend CSRF behavior is covered in `tests/smoke.spec.js`:

- GET does not add CSRF.
- POST/PUT/DELETE add `X-XSRF-TOKEN` for trusted backend URLs.
- Third-party requests do not receive CSRF headers.
- Caller headers are preserved.
- `FormData` requests are not forced to JSON content type.
- Unsafe `403` is not retried automatically.
- Clearing CSRF memory forces the next unsafe request to fetch a new token.

## Verification Commands

```powershell
cd backend
.\mvnw.cmd clean test
.\mvnw.cmd verify
.\mvnw.cmd clean package -DskipTests
```

`.\mvnw.cmd verify` runs the full backend tests, generates the JaCoCo report
under `backend/target/site/jacoco/`, and enforces the current bundle line
coverage threshold of 80%.

## Finding 12 Batch 12B Quiz-Attempt Verification

`Finding12QuizAttemptTests` uses deterministic injected attempt time and covers
owned/bounded issuance, foreign/nonexistent/duplicate words, unsupported mode,
strict non-normalizing mode validation, server-only scoring,
manufactured/missing/extra/duplicate selections, order-independent canonical
exact replay, conflicting replay, IDOR isolation, exact 24-hour expiry,
captured answer context after word edit, and concurrent identical/conflicting
submission. The concurrency assertions use persisted revision/history/stats
counts rather than timing as the security oracle.

```powershell
cd backend
.\mvnw.cmd "-Dtest=Finding12QuizAttemptTests,DatabaseSchemaTests,BackendHardeningTests" test
```

Permanent backend regression coverage also proves authenticated first/repeated
malicious calls to `POST /api/quiz-results` return the stable retirement error
with identical persisted XP, revision, history, word stats, and wrong-bank
state. The temporary `Finding12ReplayProof.java` analysis file is not part of
the suite.

Playwright covers one issuance per online round, issued prompt/item binding,
authoritative result rendering, lost-response retry with the same attempt and
payload, local-only create failure, retained submit failure, monotonic revision
handling for stale exact replay, and zero production-frontend references to the
legacy route.
It also holds a submit response until a replacement quiz starts or the account
changes, then verifies that the old response cannot mutate the new lifecycle.
The attempt-client helper suite covers reset during issuance, submit, response
parsing and manual retry, plus mismatched response identities.

Local Batch 12B evidence (2026-08-28; committed/pushed as `adc66a9f6ad89e9c24b454d5c8076d62442a876c`, not deployed):

- Focused backend security/schema/reward suites: 53 tests passed, including 11
  attempt tests and both concurrent-submit cases.
- Clean Maven `verify`: 134 tests in 26 suites, zero failures/errors/skips;
  JaCoCo line 2604/2948 (88.33%), branch 723/1167 (61.95%), line gate 80% passed.
- Maven package with tests skipped after verification: passed.
- Focused quiz Chromium: 11 passed; full Chromium: 86 passed. The 2 late-response
  cases also passed after the final test-only global-name qualification.
- Syntax: 24 JavaScript files; CSS assets: 10 files; inline-style guard: 27
  allowlisted usages across 9 files; ESLint, static build, all 7 helper suites,
  docs drift and secret scan passed.
- PostgreSQL rehearsal on 2026-08-27 used only disposable local PostgreSQL
  16.14 at loopback port 55432: fresh V1-V6 applied all 6 migrations, then repeat
  startup reported schema version 6 with no migration necessary. Each startup
  passed `QuizApplicationTests` (1/1) with prod profile/Flyway and Hibernate
  `ddl-auto=validate`. History had 6 successful rows; V6 checksum was
  `-1273792706`. The initial host timezone alias `Asia/Saigon` was rejected
  before connection; process-scoped UTC resolved the local rehearsal issue.
  The temporary container was removed; no cloud/production DB was accessed.

### Batch 12C review-operation replay protection

Approved Batch 12C evidence and full before/after matrix:
[FINDING12C.md](FINDING12C.md). Required migration is
`V7__add_review_operations.sql`; V1-V6 are unchanged.

- Focused backend: 50/50 (23 review-operation, 8 spaced repetition, 3 Findings
  5-9, 11 quiz-attempt, 5 schema tests). Characterization first reproduced all
  four replay vulnerabilities on unchanged production code, then became passing
  secure assertions; no temporary exploit test is committed.
- Clean Maven verify: 158/158 in 27 suites; zero failures/errors/skips. Package
  passed. JaCoCo lines 2634/2980 (88.39%), branches 768/1211 (63.42%).
- Chromium: focused 13/13, full 105/105. Helper suites 8/8, including 12 review
  helper cases. Syntax 25 files; lint/static build PASS; assets 10 stylesheets;
  inline ratchet 27 usages / 9 files; docs drift 31 routes / 32 env keys / V7.
- Disposable local PostgreSQL 16.14 fresh V1→V7 and actual restart/app schema
  validation each passed 1/1; seven successful history rows, V7 checksum
  -1088142411. Portable runtime at loopback port 55436, stopped afterwards.
- Secret scan and diff whitespace check PASS. No deploy/cloud or production DB
  action. Commit/push was separately approved on 2026-09-02.

### Batch 12B.1 local-progress resilience

Before changing production code, the pending-submit characterization failed:
a completed four-question round had one local history entry (3 correct, 1
wrong), but all four vocabulary `seen` counts stayed at zero and the wrong bank
was empty after both submit requests failed.

Completion now captures one immutable account-bound local result plan and uses
the existing local-only learning routine once. That local save does not schedule
sync or grant cloud XP/history/revision. Normal submit and later exact replay
replace the attempt words' learning fields and wrong-bank membership with the
authoritative snapshot, even when the local completion timestamp is newer.
Unrelated editable-field sync rules and backend trust semantics are unchanged.

The focused 11-case Chromium suite covers pending progress and repeated retry,
normal success, pending-to-success, lost-response replay, parity with local-only
standard/wrong-practice quizzes, account changes before completion, logout,
and both existing late-response regressions. Retry tests assert one issuance,
byte-identical submissions, one local history entry, and server snapshot/XP/
revision reconciliation without doubling learning counters.

Backend re-confirmation uses only in-memory H2: `Finding12QuizAttemptTests`
(11) and `BackendHardeningTests` (22) pass, including sync rejection of
client-managed learning fields, exact replay, concurrent submits, and legacy
retirement. No backend production, API, auth, schema, or migration changes are
part of this follow-up; V6 is unchanged.

Final local verification: focused Chromium 11/11 and full Chromium 94/94
passed; syntax (24 files), ESLint, static build, all seven frontend helper
suites, CSS assets (10), inline-style ratchet (27 usages / 9 files), docs drift
(31 routes / 32 environment keys / V6), secret scan, and `git diff --check`
passed. The initial full-browser runner was interrupted; the completed rerun
passed all 94 tests. No cloud/production database or deployment was involved.

Production database safety guard:

```powershell
cd backend
.\mvnw.cmd -Dtest=ProductionDatabaseSafetyGuardTests test
```

This test verifies:

- `application-prod.yml` pins Hibernate to `validate`.
- Production Flyway is enabled and validates migrations.
- Flyway clean is disabled.
- Production app startup rejects `baseline-on-migrate=true`.
- Unsafe effective overrides fail when `prod` is active.
- Migration files are ordered, contiguous, versioned, and do not contain tombstone work.

```powershell
npm run check:frontend
npm run lint
npm run test:assets
npm run test:frontend-inline-styles
npm run test:frontend-quiz-attempt-client
npm run test:frontend-learning-studio-storage
npm run test:frontend-ui-actions
npm run test:frontend-import-helpers
npm run test:frontend
npm run test:docs-drift
npm run coverage:backend
```

`npm run check:frontend` performs recursive `node --check` on all
`frontend/js/*.js` files. `npm run lint` runs ESLint over `frontend/js`,
`tests`, `scripts`, and `playwright.config.js` with
`eslint-suppressions.json` as the current legacy baseline. New lint violations
outside that baseline fail the command. `npm run test:assets` verifies that
each `frontend/css/*.css` file is linked or imported by the runtime frontend
stylesheet graph.

`npm run test:frontend-inline-styles` scans runtime HTML and JavaScript for
inline style attributes and DOM style APIs. It compares the inventory against
an exact file/API/source/count/reason allowlist, currently 27 usages across 9
files. New usages and stale allowlist entries fail locally, in CI, and in the
production release gate.

`npm run test:frontend-import-helpers` runs a Node characterization test for
`window.WordArenaImport`, covering import normalization, invalid counts,
duplicate-aware merge stats, summary counts, and Merge/Replace candidate state.
Run it whenever `frontend/js/import-helpers.js` or the `app.js` import wrappers
change.

`npm run test:frontend-learning-studio-storage` runs the focused facade suite
for exact account-key resolution, history JSON fallback, raw achievement-flag
semantics, and A/B write isolation. Playwright adds browser-level coverage for
logout/relogin account isolation, offline reload persistence, empty storage,
and malformed JSON without migration or mutation.

`npm run test:frontend-ui-actions` verifies every existing `data-ui-action`
mapping, the numeric challenge-duration argument, and unknown-action no-op
behavior. The focused Playwright coverage verifies desktop/mobile navigation,
active-page state, native click/Enter activation, and exactly one dispatch per
activation.
# Sync V2 Verification

Backend:

- `.\mvnw.cmd test` covers Sync V2 through `SyncContractV2Tests`.
- Covered invariants: required contract version, required `wordUid`, stable UID rename, tombstone precedence, idempotent repeated deletion, direct delete tombstone creation with `legacyWordId`, delete-by-UID without live row, legacy-ID user scoping, atomic duplicate-English rollback, user isolation, existing CSRF/auth regressions, and forged sync payload rejection for server-managed progress.

Frontend:

- Run `node --check` against changed files: `frontend/js/app.js`, `frontend/js/vocab.js`, `frontend/js/main.js`, `frontend/js/quiz.js`, `frontend/js/review-today.js`.
- Run `npm run test:frontend` for Playwright smoke coverage, including the legacy-device anti-resurrection case where a local word only has numeric `id` and the server snapshot only returns a tombstone.

PostgreSQL:

- CI starts PostgreSQL 16 and runs `SPRING_PROFILES_ACTIVE=prod ./mvnw -B -Dtest=QuizApplicationTests test` with Flyway enabled and Hibernate `ddl-auto=validate`.
- This verifies ordered V1 -> V8 migrations against PostgreSQL in CI. The latest migration is `V8__add_retention_cleanup_indexes.sql`. It does not execute a production or staging migration.

Docs drift:

- `npm run test:docs-drift` checks that `docs/API.md` covers current controller routes and public route classifications, that canonical docs mention the latest Flyway migration, that backend env keys are documented, and that known product/backend docs contradictions do not reappear.

## Production Release Gate

The `Production Release Gate` workflow runs from `.github/workflows/production-release-gate.yml` by `workflow_dispatch` or `workflow_call`. It does not deploy.

Gate controls include:

- full backend test suite plus JaCoCo line coverage threshold through
  `.\mvnw.cmd verify`;
- focused security regression tests: `BackendHardeningTests` and `CsrfSecurityTests`;
- observability and rate-limit controls: `ObservabilityAndRateLimitTests` and `AiRateLimitTests`;
- frontend ESLint validation through `npm run lint`;
- frontend CSS asset ownership through `npm run test:assets`;
- frontend inline-style inventory ratchet through `npm run test:frontend-inline-styles`;
- frontend static build validation through `npm run build:frontend`;
- Playwright smoke tests with report artifacts;
- Flyway rehearsal against temporary PostgreSQL with `SPRING_PROFILES_ACTIVE=prod`;
- targeted two-device sync controls using `SyncContractV2Tests` and frontend sync smoke tests;
- redacted production environment validation;
- secret scan;
- backup/rollback readiness checks;
- staging smoke only when staging variables are configured.

The gate report marks staging/OAuth/restore evidence as `BLOCKED` or `NOT_RUN` unless actually configured and executed.

## Current 2026-08-08 Verification Gaps

These are not pass/fail claims until commands are actually run for the current
commit:

- Backend Maven tests must pass in an environment with Maven/dependency access.
- Frontend build must pass through the available npm scripts.
- Playwright must pass in an environment with browser binaries installed.
- GitHub Actions status must be checked for the pushed commit.
- Production secret scan must be re-run cleanly to verify the empty-env-key false
  positive reported in the 2026-08-08 audit is no longer blocking.

## Observability And Rate-Limit Verification

Backend:

```powershell
cd backend
.\mvnw.cmd -Dtest=ObservabilityAndRateLimitTests,AiRateLimitTests test
```

This verifies:

- generated and client-supplied `X-Request-ID` behavior;
- unsafe request IDs are replaced;
- MDC contains `requestId` during a request and is cleared afterward;
- anonymous `/actuator/metrics/**` is rejected and authenticated metrics access includes application metrics;
- 4xx and 5xx request metrics are recorded;
- sync conflict, quiz failure, AI failure, and rate-limit hit counters increment;
- AI in-memory rate limit returns `429`, isolates users through existing tests, and resets after the configured test window.

## Finding 10 Performance Benchmark

Run the focused behavior regressions and the deterministic H2 benchmark from
`backend/`:

```powershell
.\mvnw.cmd "-Dtest=Finding10OptimizationTests" test
.\mvnw.cmd "-Dtest=Finding10PerformanceBenchmark" "-Dfinding10.phase=verification" test
```

The benchmark seeds separate synthetic users with 100, 1,000, and 10,000
vocabulary words. Each dataset also includes tombstones (5%), wrong-bank rows
(20%), quiz history (10%), and five unlocked achievements. It measures full
snapshot, progress, analytics overview, and review queue with `limit=20`, and
reports elapsed time, Hibernate prepared-statement count, entity loads,
response bytes, and approximate heap delta.

The query/entity-load assertions are the deterministic regression guard.
Elapsed time and heap deltas are diagnostic only because JVM warm-up and GC add
noise. H2 is useful for before/after application comparisons but is not a
substitute for PostgreSQL query plans or production-like load testing.

The benchmark requires the explicit `finding10.phase` system property and its
class name is outside Maven Surefire's default `*Test`/`*Tests` patterns. Normal
`mvn test` and `mvn verify` runs therefore do not seed the 10,000-word dataset.

## Finding 11 Batch 11A Frontend API Client

Run the endpoint-client characterization suite from the repository root:

```powershell
npm run test:frontend-ai-deck-client
npm run test:frontend-quiz-attempt-client
npx playwright test tests/smoke.spec.js --project=chromium --grep "api client|AI deck"
```

The helper suite validates the unchanged AI Deck URL, POST body, content type,
success parsing, backend error copy, rate-limit retry copy, network failure, and
malformed success response. Playwright verifies that the shared transport still
adds CSRF, the successful response renders, and the rate-limit/retry/malformed
UI states remain usable.
