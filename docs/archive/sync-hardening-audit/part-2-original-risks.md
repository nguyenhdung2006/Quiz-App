# Sync Hardening Audit Original - Risks

Historical split from $source lines 458-858. Content preserved for reference.

## Merge Rules

Frontend word identity:

- `wordMergeKey()` prefers normalized English key.
- If English is missing, it falls back to id.
- Valid merged words require both `eng` and `vie`.

Frontend winner selection:

- Compare parsed timestamp from:
  - `updatedAt`
  - `updated_at`
  - `stats.lastReviewed`
  - `stats.nextReview`
- If both sides have times: newer wins.
- If only one side has a time: timed side wins.
- If neither side has time: cloud wins.

Backend word identity:

- `/api/sync` uses normalized English, not id.
- Normalization trims and collapses whitespace; duplicate lookup is case-insensitive.
- Backend stores normalized whitespace but preserves casing.

Backend overwrite behavior:

- `/api/sync` applies the incoming request fields to the server word.
- No timestamp comparison happens in `VocabularyService.sync()`.
- No delete semantics happen in `/api/sync`.

## Timestamp Trust Audit

Current timestamp sources:

- Frontend stamps local changes with `new Date().toISOString()`.
- Frontend review offline updates use client time.
- Backend entity `updatedAt` uses server time through JPA lifecycle callbacks.
- Backend review answer uses server `Instant.now()`.
- Backend `/api/sync` receives stats timestamps from the client and stores them.

Risks:

- Client clock drift can make stale local changes look newer during frontend snapshot merge.
- Backend `/api/sync` does not reject future `stats.lastReviewed` or future `nextReview`.
- `WordStatsDto.lastReviewed` has `@PastOrPresent`, but `nextReview` can be future by design.
- `updatedAt` is not part of `WordRequest`, so the frontend cannot tell the backend "only apply this if newer".
- Null or missing timestamps cause cloud to win on pull, but later push can still overwrite cloud if local state remains and sync is manually triggered.

Risk level:

- High for simultaneous edits and stale devices.
- Medium for ordinary single-device usage.

Recommended posture:

- Treat client timestamps as hints, not authority.
- Prefer server `updatedAt` for cloud conflict decisions.
- Add defensive frontend guards before pushing stale local snapshots.

## Delete Queue Audit

Storage key:

- Base key is `cloudDeleteQueue`.
- Actual key is account-scoped through `accountStorageKey("cloudDeleteQueue")` when available.

Lifecycle:

1. Delete local word.
2. Queue server id.
3. Try DELETE immediately.
4. Before every snapshot pull or sync push, flush queue.
5. Keep failed IDs.
6. Pause sync if any remain.

Cleanup:

- Success clears id.
- 404 clears id.
- Current idempotent backend missing/foreign-user success also clears id.
- 400/500/network keeps id.

Can queue grow forever?

- Yes, if repeated network/server/auth failures persist.
- Queue stores only ids, no timestamps, retry count, account marker, or reason.

Can queue block sync forever?

- Previously yes for stale IDs returning 400.
- After idempotent backend delete, less likely.
- Still possible if auth/session is broken, backend stays 500, CORS fails, or queue belongs to wrong account and all deletes return non-ok.

Can queue survive account switching incorrectly?

- Mostly scoped by cached profile email, but account identity depends on `quizUserProfile`.
- If cached profile is wrong, missing, or changes during auth bootstrap, queue lookup can happen under the wrong account namespace.

Risk level:

- Medium after idempotent delete fix.

## Multi-Device Safety Scenarios

### Case 1 - Old Laptop Overwrite

Scenario:

- Device A adds or edits vocabulary today and syncs.
- Device B opens after two weeks offline with stale local data.

Current behavior:

- On login, Device B pulls snapshot first and merges.
- If pull succeeds, cloud data should merge into local before push.
- If local stale words have newer/future client timestamps, frontend may prefer stale local fields.
- Backend push then upserts Device B's merged local state without server-side timestamp checks.

Answer:

- Old local state usually will not wipe the cloud immediately because pull comes first.
- It can still overwrite newer cloud fields if local timestamps are wrong or if a manual/full sync happens after a failed pull.

Risk:

- High.

Small safe improvement:

- Add a "do not push until a successful snapshot pull" guard for manual/import/studio sync paths, not just scheduled sync.
- Track a per-account `lastSuccessfulSnapshotAt` and warn instead of pushing after long offline gaps.

### Case 2 - Empty Local Wipe

Scenario:

- Fresh browser or cleared localStorage opens authenticated.

Current behavior:

- Initial login pulls snapshot first.
- Empty local then merges cloud into local.
- `/api/sync` pushes merged state.
- Since backend `/api/sync` is upsert-only, sending empty arrays would not delete cloud words anyway.

Answer:

- Empty local should not wipe cloud vocabulary under the current API because sync does not delete missing words.

Risk:

- Low for wipe, medium for confusing local UI if snapshot fails and cloud is unavailable.

Small safe improvement:

- Keep the current pull-before-push behavior.
- Add clearer status when the app is authenticated but snapshot has not yet completed.

### Case 3 - Delete Replay

Scenario:

- Delete queued locally.
- Cloud delete fails.
- User reloads/login/logout.

Current behavior:

- Queue persists in localStorage.
- Snapshot and sync are paused until queue flushes.
- Backend now treats missing own word as already deleted, so stale IDs can clear.

Can deleted words reappear?

- If local delete happened but cloud delete never succeeded, snapshot pull is blocked by queue. This prevents the cloud copy from being pulled back immediately.
- If queue is lost or under the wrong account key, the cloud word can reappear on next snapshot pull.

Can queue become permanently stuck?

- Less likely after backend idempotency.
- Still possible with repeated auth/CORS/backend failures or wrong account namespace.

Risk:

- Medium.

Small safe improvement:

- Store queue entries as objects with `id`, `queuedAt`, `attempts`, and last status, while preserving backward compatibility with existing string arrays.

### Case 4 - Duplicate Merge Drift

Scenario:

- Same word exists with different casing, spacing, or edited on two devices.

Current behavior:

- Frontend merge uses normalized English key: trim, lowercase, collapse whitespace.
- Backend sync upsert also normalizes whitespace and compares case-insensitively.
- Backend create/update rejects duplicates.

Can duplicates survive?

- Existing production duplicates from schema drift can survive in database if they already exist.
- Frontend snapshot merge may collapse them visually by normalized English key, but backend list can still contain duplicate rows.
- Stats can split across duplicate database rows if production already has drift.

Risk:

- Medium/high until Supabase duplicate inspection is completed.

Small safe improvement:

- Add a backend audit/log warning or test around duplicate normalized rows.
- Do not auto-merge production duplicates without manual review.

### Case 5 - Simultaneous Edits

Scenario:

- Two tabs/devices edit the same word.

Current behavior:

- Direct PUT by id updates server immediately if online.
- Later full sync from either device can overwrite fields by normalized English.
- No version, ETag, or "updated since" guard exists.

Which version wins?

- On server, last request processed wins.
- On frontend pull merge, the word with the newest parsed timestamp wins.

Is `updatedAt` trustworthy enough?

- Good enough for ordinary single-device freshness.
- Not trustworthy enough for robust multi-device conflict resolution because client clocks and stale local timestamps are involved.

Risk:

- High for concurrent power users.

Small safe improvement:

- Avoid silently overwriting if local word timestamp is older than server `updatedAt` from the last pulled snapshot.

### Case 6 - Offline Review Progress

Scenario:

- User reviews words offline.
- Later sync resumes.

Current behavior:

- Local stats are updated with client time.
- Cloud review answer is skipped/fails.
- Later full sync sends local stats to `/api/sync`.
- Backend applies incoming stats directly.

Can later sync corrupt review scheduling/streak/mastery?

- Yes. Offline progress can overwrite newer cloud stats from another device.
- Future or incorrect client clocks can shift `nextReview`.

Risk:

- High.

Small safe improvement:

- Clamp obviously invalid stats/timestamps in backend sync.
- Prefer max counters for seen/correct/wrong/bestStreak where safe, rather than blind replacement.
- Avoid changing scheduling architecture until this is separately tested.

## Failure Mode Audit

### Backend Offline Or Render Cold Start

Current behavior:

- `/api/me` retries before deciding transient failure.
- Snapshot/sync set "Cloud unavailable" or "Offline/local mode".
- Local app remains usable.

Risk:

- Low/medium. UX is acceptable after recent auth stabilization.

### Supabase Latency Or 500

Current behavior:

- Frontend treats non-ok snapshot/sync as cloud unavailable.
- Local state is preserved.
- Analytics/review use local fallback.

Risk:

- Medium. Repeated 500s can pause cloud confidence and leave local/cloud divergent.

### OAuth Expired Session

Current behavior:

- `/api/me` 401/403 redirects in production.
- Other endpoints returning 401/403 are generally classified as request failure/null, not always explicit login-required.

Risk:

- Medium. Direct sync failures do not clearly distinguish unauthenticated from backend unavailable.

### CORS Temporary Failure

Current behavior:

- Fetch throws; auth bootstrap warns and keeps local data.
- Sync/snapshot fall back to local/offline status.

Risk:

- Low for data loss, medium for user confusion.

### Malformed Snapshot Response

Current behavior:

- `await response.json()` is inside try/catch, so malformed JSON becomes offline/local status.
- `applyServerSnapshot()` ignores missing arrays.

Risk:

- Low/medium.

### localStorage Failure

Current behavior:

- Delete queue write catches quota errors.
- General `save()` does not catch localStorage errors.

Risk:

- Medium. Private browsing/quota issues can break local persistence outside delete queue.

## Risky Files And Functions

Highest risk:

- `frontend/js/app.js`
  - `syncCloudNow()`
  - `pullCloudSnapshot()`
  - `scheduleCloudSync()`
  - `applyServerSnapshot()`
  - `chooseMergedWord()`
  - `mergeWordLists()`
  - `flushPendingCloudDeletes()`
  - `deleteCloudWord()`
- `backend/src/main/java/com/quizapp/vocab/VocabularyService.java`
  - `sync()`
  - `upsertByEnglish()`
  - `applyWordRequest()`
  - `deleteWord()`
- `frontend/js/review-today.js`
  - `postAnswer()`
  - `applyLocalAnswer()`
  - `answerItem()`

Medium risk:

- `frontend/js/storage.js`
  - `switchAccountStorage()`
  - `save()`
  - `accountStorageKey()`
- `frontend/js/vocab.js`
  - `saveEditedWord()`
  - `syncWordUpdate()`
  - `deleteWord()`
  - `markWordKnown()`
  - `markWordHard()`
- `frontend/js/learning-studio.js`
  - `importWordsToVocabulary()`
  - `mergeWordsWithImportStats()`

Low risk:

- `frontend/js/analytics-dashboard.js`
  - read-only cloud fallback behavior

## Biggest Production Risks

1. Stale multi-device overwrite because backend `/api/sync` blindly applies incoming fields.
2. Client timestamp trust because frontend merge uses local `updatedAt`, `lastReviewed`, and `nextReview`.
3. Offline review progress conflict because local review stats can later overwrite newer cloud stats.
4. Delete queue can still block sync during repeated auth/backend/CORS failures and lacks diagnostics.
5. Existing production duplicate normalized words can split stats and confuse merge.
6. Account-scoped localStorage depends on cached profile email, so bootstrap/account switching deserves care.
7. `/api/sync` has no delete semantics, so "replace import" does not truly replace cloud data.

