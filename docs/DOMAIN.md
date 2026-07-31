# Domain

## Core Concepts

Vocabulary word: user-authored learning content with English, Vietnamese meaning, POS, tag, IPA, level, examples, collocations, synonyms, antonyms, common mistakes, notes, favorite flag, and stable `wordUid`.

Quiz session: a submitted set of answers. Client-provided totals are untrusted. The backend resolves answers to the authenticated user's vocabulary and computes official total, correct, wrong, score, max combo, XP, achievements, history, stats, and wrong-bank changes.

Answer: a selected response for a word and question mode. Only answers that resolve to a word owned by the current user can affect official progress.

Wrong bank: server-managed set of words missed in quiz/review flows. Sync cannot create official wrong-bank mastery by sending `wrongWords`.

Review schedule: official cloud review schedule is computed by backend review/quiz services. The frontend can maintain local fallback stats while offline, but server state remains authoritative after authenticated calls.

Mastery: official mastered flag and mastery level are server-managed. Sync payloads cannot set them directly.

XP and achievements: server-managed. They are derived from verified answers and server-owned rules.

Sync revision: monotonic per-user revision on `AppUser`. Sync V2 requires `expectedRevision`; stale revisions return 409 without partial write.

Tombstone: server-side deletion state for a `wordUid`, with deletion time, deleted revision, user ownership, and optional `legacyWordId` for upgraded clients.

## Invariants

- A user can only read or mutate their own vocabulary, stats, history, achievements, and tombstones.
- Tombstones are applied before upserts.
- A tombstoned `wordUid` cannot be resurrected by a stale sync payload.
- Deletion is idempotent.
- Client sync can edit vocabulary content fields, profile fields allowed by `ProfileRequest`, and favorite flag.
- Client sync cannot set XP, level, achievements, official stats, official mastery, official history, ownership, revisions, server timestamps, or tombstones except through the deletion contract.

## Edge Cases

- Empty forged quiz answers create no XP or achievements.
- Answers for another user's words are ignored for official progress.
- Duplicate English words are normalized by trim, whitespace collapse, and lowercase comparison.
- Legacy local words without `wordUid` are reconciled through `legacyWordId` tombstones where available.
