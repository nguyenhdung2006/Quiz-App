# Production Hardening Status

Consolidated status of all production hardening features implemented for WordArena.

Last updated: 2026-06-09 (incident fixes documented)

---

## 1. Current Production Hardening Status

| # | Task | Status | Key Mechanism |
|---|------|--------|---------------|
| 1 | Force pull before push | Done | `pullCloudSnapshot()` runs before every `syncCloudNow()` push; frontend refuses push if pull fails |
| 2 | Stale device guard | Done | Stale device detection on auth bootstrap; warns user and pulls fresh snapshot instead of pushing |
| 3 | `sync_revision` / optimistic concurrency | Done | Monotonic revision counter on `AppUser`; push sends expected revision; 409 Conflict on mismatch forces pull-and-retry |
| 4 | Delete queue hardening | Done | `cloudDeleteQueue` in localStorage with attempts/backoff/lastError/lastStatus; blocks full sync while pending; idempotent backend DELETE |
| 5 | Backend validation / clamp | Done | `sanitizeStats()` clamps all numeric fields to `[0, 1_000_000]`; `MAX_SAFE_COUNT` guard in review/analytics; `isUsableSyncWord()` filters malformed sync payloads |
| 6 | Supabase schema audit | Done | Read-only audit of 8 tables against entities, `database/schema.sql`, and code assumptions; 15 SQL queries ready for manual Supabase execution (see `docs/schema-audit.md`) |
| 7 | Flyway baseline strategy | Done | Staged rollout plan documented; rehearsal executed locally against PostgreSQL 17 (PASS). Flyway disabled by default (`FLYWAY_ENABLED=false`). See `docs/flyway-baseline-strategy.md` |
| 8 | Structured logging | Done | 8 log prefixes (`[SYNC]`, `[AUTH]`, `[AI]`, `[REVIEW]`, `[SNAPSHOT]`, `[ANALYTICS]`, `[QUIZ]`, `[ERROR]`) across all service classes |
| 9 | Error surface UI | Done | Improved sync/auth error messaging, retry buttons (Sync Retry, AI Deck Retry, Review Retry), persistent submit error feedback, delete queue status in sync UI |
| 10 | Basic health monitoring | Done | `/api/health`, `/api/health/summary`, `/actuator/health`, `/actuator/info` with in-memory counters; logging hygiene (no PII emails, no misleading `[AUTH]` tag on generic errors) |
| 11 | Production incident documentation | Done | Documented in `docs/deploy.md#production-incident-fixes`: missing `sync_revision` column (manual SQL), PgBouncer `prepareThreshold=0`, first-sync deadlock fix (`!lastSync → return false`), secret audit, smoke test results, future deploy checklist |

---

## 2. Sync Safety Model

### Current Model

- **Local-first**: vocabulary is always written to localStorage first; cloud is backup/sync target.
- **Pull before push**: `syncCloudNow()` calls `pullCloudSnapshot()` first; push only proceeds if pull succeeds.
- **Trusted cloud state**: cloud snapshot is treated as authoritative during pull; local words missing from cloud are re-added during push.
- **Stale device guard**: on auth bootstrap, if local `lastSyncedAt` is older than cloud `updatedAt`, the device is flagged stale; user is prompted to pull first.
- **Optimistic concurrency**: push sends `syncUser.getSyncRevision()` as `expectedRevision`; backend compares with current revision; 409 Conflict forces frontend to pull and retry.
- **Delete queue**: local deletes are queued in `cloudDeleteQueue` (localStorage). Flush happens before every pull. Full sync is blocked while deletes are pending. Backend DELETE is idempotent.
- **Merge rules**: frontend `mergeWordLists()` uses normalized English key with timestamp comparison (newer wins, cloud wins ties). Backend `upsertByEnglish()` by-passes timestamp comparison — last write wins.

### Known Limitations

- **No tombstone/deletedIds protocol**: deleted words are removed from cloud entirely. Re-appearance on another device can resurrect them.
- **Rare delete/snapshot race**: if a delete is queued but not flushed before another device pushes the same word, the word can reappear after the delete flushes.
- **No CRDT/event sourcing**: conflicts are resolved by last-write-wins with timestamp tie-breaking. No event log or merge history.
- **Client timestamp trust**: merge uses `new Date().toISOString()` timestamps; clock drift between devices can cause stale data to appear newer.
- **Upsert-by-English in full sync**: `/api/sync` applies all fields blindly without timestamp comparison; full sync can overwrite newer cloud stats with older local values.

See `docs/sync-hardening-audit.md` for detailed flow diagrams and scenario analysis.

---

## 3. Delete Semantics

### Current Behavior

- Local remove is immediate (word removed from in-memory `vocab[]` and localStorage).
- Delete intent is queued in `cloudDeleteQueue` as `{ wordId, english, timestamp }`.
- Queue is persisted in localStorage; survives reload.
- Before each sync, queue is flushed: each item is sent to `DELETE /api/vocab/{wordId}`.
- Backend DELETE is idempotent (finds word by id+user; deletes if exists; no-op otherwise).
- Full sync push is blocked while queue is non-empty.
- Failed deletes are retried with exponential backoff (`lastError`, `lastAttempt` tracked).
- Queue items are never automatically removed after max attempts — they remain visible in sync status (`"Delete pending: N item(s). Sync will retry automatically."`).
- Fire-and-forget delete path (non-cloud user) has `.catch(console.warn)` for observability (Task 9C).

### Known Limitations

- **No tombstone protocol**: no record on cloud that a word was deleted; another device can re-push the same word.
- **No dead-letter UI**: no admin interface to inspect, retry, or clear stuck queue items.
- **No automatic removal**: queue items with persistent failures (e.g. word already deleted on cloud, 404) are never cleaned up automatically.

---

## 4. Review Semantics

### Current Behavior

- Review is local-first: `applyLocalAnswer()` mutates `WordStats` in localStorage immediately.
- Cloud submit is async: `answerItem()` sends answer to backend after local mutation.
- If cloud submit fails, local stats are already saved; error message is shown persistently (Task 9E).
- Full sync push later sends all local word stats (including locally-computed intervals) to backend via `upsertByEnglish()`.
- Frontend computes `nextReviewDate()` based on simple streak-based fixed intervals (1/3/7/14/30 days).
- Backend uses SM-2 algorithm in `SpacedRepetitionService.applyAnswer()`.

### Known Limitations

- **No pending review-answer queue**: if cloud submit fails, the review event is lost. Only the final mutated stats survive.
- **Frontend/backend interval divergence**: after cloud failure, frontend stores its own interval. On next full sync push, frontend's interval overwrites backend's SM-2 calculation. They converge, but the SM-2 result is discarded.
- **Advancement before success**: `answerItem()` advances the review session (increment counter, remove from queue, refresh UI) before cloud confirmation. This is intentional local-first design — the review session never stalls on network issues.

---

## 5. Observability / Health

### Endpoints

| Endpoint | Type | Auth | Purpose |
|----------|------|------|---------|
| `GET /api/health` | Custom REST | Public | Lightweight alive check: `{"status":"ok","app":"quiz-app"}` |
| `GET /api/health/summary` | Custom REST | Public | Live counters since last restart (see counters below) |
| `GET /actuator/health` | Spring Boot Actuator | Public | Liveness/readiness probes; details hidden (`show-details=never`) |
| `GET /actuator/info` | Spring Boot Actuator | Public | App metadata: name, version, environment, AI/Flyway flags |

Configuration in `application.properties`:

```properties
management.endpoints.web.exposure.include=health,info
management.endpoint.health.probes.enabled=true
management.endpoint.health.show-details=never
```

### Health Counters (in-memory, reset on restart)

Returned by `GET /api/health/summary`.

| Counter | Source | Incremented |
|---------|--------|-------------|
| `syncConflicts` | `GlobalExceptionHandler` | 409 revision conflict response |
| `syncFailures` | — | Not yet implemented |
| `aiFailures` | `AiDeckGeneratorService`, `AiExplanationService` | AI call failure triggers fallback |
| `reviewFailures` | `SpacedRepetitionService` | Invalid review payload (word not found) |
| `snapshotFailures` | `VocabularyService.snapshot()` | Any exception during snapshot pull |
| `quizFailures` | `VocabularyService.recordQuizResult()` | Any exception during quiz recording |
| `analyticsFailures` | `LearningAnalyticsService.overview()` | Any exception during analytics generation |
| `validationErrors` | `GlobalExceptionHandler` | 400 validation/bad request/malformed body |
| `serverErrors` | `GlobalExceptionHandler` | Any unhandled `RuntimeException` (500) |

All counters are aggregate only — no user IDs, no PII, no request bodies, no stack traces.

### Log Prefixes

| Prefix | Files |
|--------|-------|
| `[SYNC]` | `VocabularyService`, `GlobalExceptionHandler` |
| `[AUTH]` | `CurrentUserService`, `GlobalExceptionHandler` |
| `[AI]` | `AiDeckGeneratorService`, `AiExplanationService`, `OpenAiDeckGeneratorClient`, `OpenAiExplanationClient`, `GlobalExceptionHandler` |
| `[REVIEW]` | `SpacedRepetitionService` |
| `[SNAPSHOT]` | `VocabularyService` |
| `[ANALYTICS]` | `LearningAnalyticsService` |
| `[QUIZ]` | `VocabularyService` |
| `[ERROR]` | `GlobalExceptionHandler` (catch-all `RuntimeException`) |

### Logging Hygiene

- No email addresses logged (removed in Task 10B).
- No OAuth subjects logged (except opaque `sub` on OAuth failure path — not an email).
- No request bodies, vocabulary contents, or AI prompts in log messages.
- No stack traces in log lines (exception message only; full trace in log framework output).

### Render / Production Health Check

- Render health check path: `/api/health` or `/actuator/health`.
- Liveness probe uses `management.endpoint.health.probes.enabled=true`.

---

## 6. Production Deployment Notes

### Database

- Production Supabase must have `app_users.sync_revision` column (bigint, default 0).
- `JPA_DDL_AUTO` should be `validate` in production after schema is stable.
- Flyway production migration is **disabled by default** (`FLYWAY_ENABLED=false`).
- Do **not** blindly enable Flyway baseline on production. Follow the staged rollout in `docs/flyway-baseline-strategy.md`:
  1. Backup production database.
  2. Deploy with `FLYWAY_ENABLED=false` and `JPA_DDL_AUTO=validate`.
  3. Verify health check passes.
  4. During planned window: set `FLYWAY_BASELINE_ON_MIGRATE=true`, restart, verify baseline created.
  5. Immediately remove `FLYWAY_BASELINE_ON_MIGRATE=true`, restart, verify post-baseline startup.
  6. Only then add V2+ migrations.
- Existing `database/schema.sql` is additive/repair-style — not equivalent to clean `V1__baseline_schema.sql`.

### Health Endpoints

- Render health check: `/api/health` or `/actuator/health`.
- Debugging since last restart: `GET /api/health/summary`.
- `/api/health/summary` counters reset on every deploy — expected.

### Environment Variables

Full table in `docs/deploy.md`. Key settings:

| Variable | Production Value |
|----------|------------------|
| `SESSION_COOKIE_SAME_SITE` | `none` |
| `SESSION_COOKIE_SECURE` | `true` |
| `APP_ENV` | `production` |
| `JPA_DDL_AUTO` | `validate` (post-baseline) |
| `FLYWAY_ENABLED` | `false` (default; enable only during baseline window) |

---

## 7. Remaining Risks / Future Tasks

### P1 — Not Yet Implemented

| Risk | Description |
|------|-------------|
| Tombstone/deletedIds protocol | No cloud-side record of deleted words; resurrection possible from another device |
| `syncFailures` counter | No dedicated sync-failure counter; failures are counted under `serverErrors` or not counted |

### P2 — Would Improve Safety

| Risk | Description |
|------|-------------|
| Pending review-answer queue | Review events lost on cloud failure; only final mutated stats survive |
| Dead-letter UI for delete queue | No admin interface to inspect, retry, or clear stuck delete queue items |
| Delete queue auto-cleanup | Queue items with persistent failures (404, auth) are never automatically removed |

### P3 — Deferred

| Risk | Description |
|------|-------------|
| External monitoring (Sentry/Prometheus/Grafana) | Not justified at current scale; log scraping sufficient |
| DB-backed persistent counters | Counters reset on restart; DB-backed counters are overkill for current usage |
| CRDT/event sourcing sync | Fundamental architectural change; not needed for single-device-primary use case |
| Content moderation | No AI-generated content review or user content moderation |
| Per-user breakdown of health counters | Adds complexity not yet justified |

---

## 8. Production Incident Record

Summary of production incidents documented in `docs/deploy.md#production-incident-fixes`.

### 8.1 Missing `app_users.sync_revision` Column

- **Symptom:** Backend 500s on sync; app startup failure with
  `JPA_DDL_AUTO=validate`.
- **Root cause:** Supabase created before `sync_revision` entity field existed.
- **Fix:** Manual SQL: `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS
  sync_revision BIGINT NOT NULL DEFAULT 0;`
- **Prevention:** Planned migration or manual SQL before deploying entity
  changes. `JPA_DDL_AUTO=validate` catches future drift.

### 8.2 PgBouncer `prepareThreshold=0`

- **Symptom:** `ERROR: prepared statement "S_1" does not exist` on any DB query.
- **Root cause:** Supabase pooler (PgBouncer transaction mode, port 6543)
  conflicts with JDBC server-side prepared statement caching.
- **Fix:** Append `?prepareThreshold=0` to `DATABASE_URL`.
- **Prevention:** Verify `DATABASE_URL` after every env/pooler change.

### 8.3 First-Sync Deadlock (Stale Guard)

- **Symptom:** "Sync paused to protect your data" on first login; `/api/sync`
  never called.
- **Root cause:** `if (!lastSync) return cloudUpdated > 0;` — returned stale
  when cloud had data but `lastSuccessfulSyncAt` was null.
- **Fix:** Changed to `if (!lastSync) return false;` in `app.js:270`.
- **What remains active:** 7-day stale guard, `sync_revision` / 409 conflicts,
  pull-before-push, delete queue blocking.
- **Prevention:** First-sync path tests added; stale guard logic should be
  reviewed if new sync-blocking conditions are added.

### 8.4 GitHub Secret Audit

- **Result:** No real `.env` files committed. Only `.env.example` and
  `backend/.env.example` are tracked.
- **Mechanisms:** GitHub Secret Protection / Push Protection enabled.
- **Rule:** Never commit real `.env` files or screenshot secret configuration
  pages.

### 8.5 Production Smoke Test (June 9, 2026)

All public endpoints verified after fixes. Full results in
`docs/deploy.md#production-incident-fixes`. No broken endpoints detected.

---

## References

| Document | Content |
|----------|---------|
| `docs/sync-hardening-audit.md` | Detailed sync safety audit with flow diagrams |
| `docs/schema-audit.md` | Read-only schema audit; 15 Supabase SQL queries |
| `docs/production-schema-drift-audit.md` | Per-column drift risk analysis |
| `docs/flyway-baseline-strategy.md` | Staged Flyway rollout plan |
| `docs/flyway-baseline-rehearsal.md` | Local rehearsal results against PostgreSQL |
| `docs/deploy.md` | Full deployment guide with env vars |
| `docs/oauth-google.md` | Google OAuth configuration |
| `docs/backend-postgres.md` | Backend PostgreSQL notes |
| `docs/product.md` | Product overview |
