# Sync Hardening Audit

Last refreshed: 2026-08-08

This file is the current sync summary. The original long sync audit was split
for readability and preserved under `docs/archive/sync-hardening-audit/`.

## Current Contract

Sync is now V2 and server-revision based:

- `POST /api/sync` requires `syncContractVersion: 2`.
- `expectedRevision` is required; stale clients receive `409 SYNC_REVISION_CONFLICT`.
- Vocabulary identity is stable `wordUid`, not English text or local numeric ID.
- `deletions: [{ wordUid }]` is the delete contract.
- Server tombstones are returned in snapshots and win over live payload items.
- Tombstones include nullable `legacyWordId` so upgraded old clients can remove
  deleted local words that never adopted the server `wordUid`.
- Backend sync applies editable vocabulary/profile fields but does not accept
  client-supplied official XP, achievements, stats, mastery, history, revisions,
  timestamps, or tombstones outside the deletion contract.

## What The Old Audit Got Right

The original audit correctly identified risks in the pre-V2 system:

- stale devices could overwrite newer data;
- delete queues were too fragile without server tombstones;
- client timestamps were untrusted;
- full-list sync and local-first fallback needed careful guards.

Those risks drove the current V2 design.

## Current Open Risks

| Risk | Status | Notes |
| --- | --- | --- |
| Oversized `/api/sync` JSON body | OPEN | Bean Validation list limits run after deserialization. Add a pre-Jackson body cap and chunk/delta sync. |
| Full snapshot payload growth | OPEN | Snapshot still returns live vocab and all tombstones; add pagination/delta/ack once real account sizes justify it. |
| Tombstone retention policy | OPEN | Retention is intentionally conservative; do not delete tombstones blindly. |
| Offline/local stats drift | OPEN | Local-first stats are useful offline, but official cloud stats remain server-authoritative. |
| Frontend sync complexity | OPEN | `app.js` still owns a large amount of sync/auth/profile/import behavior. |
| Multi-instance rate/concurrency assumptions | PARTIALLY RESOLVED | DB revision locking protects sync writes; AI limiter is still in-memory and single-instance only. |

## Historical Split Files

- `docs/archive/sync-hardening-audit/part-1-original-architecture.md`
- `docs/archive/sync-hardening-audit/part-2-original-risks.md`
- `docs/archive/sync-hardening-audit/part-3-follow-up.md`
