# Sync Hardening Audit Original - Follow Up

Historical split from $source lines 859-1073. Content preserved for reference.

## Safest Immediate Fixes

### 1. Guard all full sync pushes until snapshot has been pulled

Risk level: Low

Expected benefit:

- Reduces stale laptop and manual sync overwrite risk.

Implementation complexity:

- Small frontend change.

Schema change required:

- No.

Notes:

- `scheduleCloudSync()` already tries to pull first.
- Manual `window.quizCloud.syncNow()`, import flows, and Studio sync can call `syncCloudNow()` directly. Add a defensive guard inside `syncCloudNow()` itself: if `cloudSnapshotPulled` is false, attempt pull and only push after success.

### 2. Add stale-local warning before pushing after long offline gaps

Risk level: Low/medium

Expected benefit:

- Gives the user a chance to avoid overwriting cloud with old local data.

Implementation complexity:

- Small frontend change.

Schema change required:

- No.

Notes:

- Store per-account `lastSuccessfulSnapshotAt`.
- If last snapshot is older than a threshold, pull first and show a non-destructive warning on failure.

### 3. Make delete queue entries diagnostic-compatible

Risk level: Low

Expected benefit:

- Easier production debugging without clearing queues blindly.

Implementation complexity:

- Small frontend change with backward compatibility.

Schema change required:

- No.

Notes:

- Continue reading existing string arrays.
- Write future entries as `{ id, queuedAt, attempts, lastStatus }`.

### 4. Distinguish auth failure from cloud failure in sync requests

Risk level: Low

Expected benefit:

- Avoids treating 401/403 like generic backend outage.

Implementation complexity:

- Small frontend change.

Schema change required:

- No.

Notes:

- `requestJson()`, `pullCloudSnapshot()`, `syncCloudNow()`, and `flushPendingCloudDeletes()` can display a session-expired message without clearing local data.

### 5. Clamp unsafe sync stats on backend

Risk level: Medium

Expected benefit:

- Prevents malformed/offline client stats from corrupting review state.

Implementation complexity:

- Small to medium backend change with targeted tests.

Schema change required:

- No.

Notes:

- Counts should stay non-negative.
- `masteryLevel` should stay 0-5.
- Future `lastReviewed` should be rejected or clamped.
- Very far future `nextReview` should be treated carefully.

### 6. Make backend sync less destructive for stats

Risk level: Medium

Expected benefit:

- Reduces offline review conflicts.

Implementation complexity:

- Medium and requires careful tests.

Schema change required:

- No.

Notes:

- Consider max/monotonic handling for `seen`, `correct`, `wrong`, `bestStreak`.
- Be careful with `currentStreak`, `masteryLevel`, and `nextReview`; these are not simply monotonic.
- Do not implement without targeted conflict tests.

### 7. Add sync regression tests for stale and delete cases

Risk level: Low

Expected benefit:

- Prevents future accidental regressions.

Implementation complexity:

- Small to medium.

Schema change required:

- No.

Candidate tests:

- Initial sync pulls before push.
- Stale delete ID clears after idempotent backend delete.
- Duplicate normalized English does not create a second backend word.
- Offline review sync with invalid stats is handled safely after backend clamp work.

## Dangerous Fixes To Avoid

- Do not clear `localStorage` or delete queues automatically.
- Do not add delete semantics to `/api/sync` without a migration and strong UI confirmation.
- Do not introduce CRDT/event sourcing/WebSockets for this project phase.
- Do not merge production duplicate words automatically.
- Do not trust client timestamps as authoritative conflict resolution.
- Do not add database tables for revisions until smaller guards are exhausted.
- Do not make `/api/sync` reject whole payloads for one bad word without a compatibility plan.

## Is The Current Architecture Salvageable?

Yes. For a focused vocabulary learning app, the current local-first architecture can be made production-safe enough with small guardrails.

It is not suitable for strong multi-device conflict guarantees. That is acceptable if product expectations are framed as "local-first with cloud backup/sync" rather than "real-time multi-device collaborative editing."

The safest path is incremental hardening:

- protect against stale pushes,
- improve delete queue diagnostics,
- clamp bad stats,
- add regression tests,
- inspect production drift/duplicates,
- only then consider more formal versioning if real user behavior demands it.

## Recommended Order Of Future Hardening Work

1. Add a guard inside `syncCloudNow()` so every full push requires a successful snapshot pull first.
2. Add per-account `lastSuccessfulSnapshotAt` and status copy for stale/offline recovery.
3. Upgrade delete queue storage to include attempts/status while reading old string arrays.
4. Add frontend tests for first-pull-before-push and delete queue clearing behavior.
5. Add backend validation/clamping tests for sync stats.
6. Run Supabase duplicate/null/orphan inspection from the schema drift audit.
7. Add backend sync conflict tests before changing stats merge behavior.
8. Plan Flyway baseline only after production data inspection is clean.

## Current Reliability Verdict

Single-device usage: Good after recent auth/delete/schema hardening.

Offline local usage: Good for preserving local data, medium risk for later cloud reconciliation.

Multi-device usage: Risky. The app avoids the most obvious empty wipe, but stale overwrites remain possible.

Delete safety: Much improved after idempotent backend delete, but queue diagnostics are still weak.

Production readiness: Improving, but not fully mature. The next work should be guardrails and tests, not new features.
# 2026-07-31 Sync V2 Follow-Up

Implemented hardening items:

- `SyncService` requires `syncContractVersion: 2`.
- `expectedRevision` is required; stale revisions return `409 SYNC_REVISION_CONFLICT` before mutation.
- Full sync locks the `AppUser` row with pessimistic write locking.
- Sync identity is `wordUid`, not English.
- `wrongWords` request data is ignored for upsert/create.
- Deletions are modeled as `deletions: [{ wordUid }]`.
- Tombstones are returned in snapshots and override live payloads.
- Tombstones include nullable `legacyWordId` so upgraded legacy devices can remove deleted local words before they ever adopted the server `wordUid`.
- Revision increments at most once per sync and does not increment for idempotent repeated deletes/no-op tombstone payloads.

Remaining operational gap: a real staging database rehearsal was not executed locally in this workspace. CI now provides PostgreSQL migration plus Hibernate validate coverage.
