# Finding 12C — review operation replay boundary

Base: `52c39322deb109810496ac090b1508ddc085648c`, branch
`chore/audit-reconciliation-and-upgrade`. Implementation and verification were
approved for commit on 2026-09-02. No deployment, cloud/production database
access, Finding 13 work, or retention cleanup is included.

## Characterization before production changes

Four passing characterization cases ran against the unchanged production code
on 2026-08-28. Starting from a new due word, each first request and exact replay
returned 200. The suite has since been converted to permanent secure assertions
in `Finding12ReviewOperationTests`; this table preserves the original evidence.

| UI action | Endpoint and logical mode | Previous local behavior / cloud retry | First → exact replay before fix | After 12C |
| --- | --- | --- | --- | --- |
| Today Good / Easy | `/api/review/answer`, `review`, true | After HTTP response; any failure fell back locally; no operation identity | seen/correct 1→2, streak 1→2, mastery level 1→2, schedule +1→+3 days | Same ID replays original result; another ID fails if no longer due |
| Today Again | `/api/review/answer`, `review`, false | Same fallback path | seen/wrong 1→2, streak/mastery 0, next-review timestamp moves again | Same ID mutates once; stale due-state conflict cannot apply local learning |
| Vocabulary Mark Known | `/api/review/known` | Optimistic local increment then cloud; no exact retry helper | seen/correct 1→2, streak 2→3, mastery level 3→4, schedule +3→+7 days | Same ID replay; new completed click remains the original command algorithm |
| Vocabulary Mark Hard | `/api/review/answer`, `mark-hard`, false | Optimistic local wrong-bank mutation then cloud | seen/wrong 1→2, streak/mastery 0, schedule moves again | Same ID replay; new explicit command permitted, no review-due restriction |

All four characterization cases had revision **1→2→3**. XP and quiz history did
not change. Root cause: the existing pessimistic user lock serialized calls but
there was no logical operation identity/outcome ledger, and review mutation did
not test the queue's due predicate. `ReviewAnswerRequest.mode` was ignored.

The actual Mark Hard caller is `markWordHard` in `frontend/js/vocab.js`, through
`quizCloud.markHard` in `frontend/js/app.js`; it has no separate endpoint.
Every production review mutation now uses `review-operation-client.js`.
`config.js` retains its existing CSRF/fetch behavior, without generic unsafe
request retry. No OAuth/session algorithm was changed.

## Persistence and transaction boundary

New migration: `V7__add_review_operations.sql`. V1-V6 are untouched.
`database/schema.sql` mirrors V7. The bounded `review_operation` table stores:

- UUID primary key, authenticated owner, original word ID, validated action;
- SHA-256 canonical fingerprint, created/consumed timestamps;
- original mastery percentage, streak, next-review time, message and revision;
- nullable live word/owner composite reference, allowing an original result to
  survive word deletion without resurrecting that word.

There are no snapshots or JSON blobs. Owner FK and composite live-word FK plus
checks enforce ownership; bounded/non-null columns prevent a partial accepted
result. Normal lookup uses the primary key. Owner/live-word indexes support FK
deletion checks. `TIMESTAMPTZ` and UUID follow existing PostgreSQL conventions;
server times are truncated to microseconds so first/replay serialization agrees.

One `@Transactional` service path holds the existing user's
`PESSIMISTIC_WRITE` lock across lookup, owner/fingerprint check, due validation,
the unchanged learning algorithm, wrong-bank synchronization, revision increment
and ledger insertion. The repository exposes INSERT, not merge/upsert; the
entity is immutable. Exact replay branches before any learning/revision write.
Global UUID uniqueness also covers different owners that do not share a lock;
an insertion collision fails 409 and rolls back the entire losing transaction.
There are no distributed locks.

## Contract and accepted-result identity

No route was added. Both existing mutations now require a UUID `operationId`:

```json
{"operationId":"00000000-0000-4000-8000-000000000001","wordId":123,"correct":true,"mode":"review"}
```

Known requires `operationId` and `wordId`. Answer requires a boolean `correct`
and mode. Mode is ROOT-locale lowercase after trimming, validated against
`review` and `mark-hard`; Mark Hard only accepts false. Unknown/null modes,
missing/malformed IDs, missing correctness, foreign/nonexistent words fail
closed. The server does not consume client stats, mastery, schedule or revision.

Fingerprint input: UTF-8 `review-operation-v1|action|wordId|correct`, SHA-256.
Known's action is `known` and correctness is fixed true. Validated action names,
positive numeric IDs and booleans make this unambiguous and independent of JSON
property order. Changed action, word or answer under an ID returns 409.
Ownership is checked before any immutable result can be returned.

Response `outcome` is immutable: operation ID, original word ID/action, mastery,
streak, next review, message, resulting revision. `replayed` is explicit.
`word`, `inWrongBank`, `revision`, and `X-Sync-Revision` are the current read model.
A later revision never means replay awarded another mutation. Current wrong-bank
membership prevents an old Hard replay from undoing a later clear. A successful
replay for a deleted target returns `word:null` and preserves the original outcome.

Only mode `review` requires non-null `nextReview <= server now`, exactly the
queue predicate. Its accepted answer moves the schedule into the future, so
different IDs from two stale tabs cannot consume the same due state. Review
remains self-rating; Good/Easy are logically identical true ratings, not
server-verifiable multiple-choice answers. Known/Hard retain their existing
new-intent semantics and do not require a due word.

## Frontend delivery and local-first behavior

`WordArenaReviewOperationClient` is dedicated to these three commands. It
generates one cryptographic UUID per online intent, freezes the serialized body,
shares in-flight work for the same word and makes at most two sends per retry
cycle. Network/unknown-response failures retain the exact operation for Retry
Review, Retry Sync or reconnect. Clicking a pending word resolves the prior
intent before a new command can be created, even if the second click is a
different action. No timeout/retry creates a replacement UUID.

Known/Hard retain optimistic local behavior. Today applies fallback only after
an uncertain failure, once per operation; definite rejection does not cause
another local review. Reconciliation replaces learning and wrong-bank state,
not increments it. These saves use local-only persistence and do not schedule
an optimistic stats sync. Rejection reconciliation uses a read-only snapshot;
a missing unsynced local word is not misinterpreted as an authoritative deletion.

Account/generation checks run after fetch and JSON parsing, before any learning,
revision or UI update. Account switch/logout clears pending delivery and review
UI; old queue responses are ignored. Replacement Review sessions have a separate
UI generation so old completions cannot count toward the new session.
Revision tracking remains monotonic. Memory-only pending state is intentionally
lost on reload; no localStorage migration or new offline reward claim is added.

## Permanent evidence

- Good/Again/Known/Hard exact retry: identical immutable outcome and revision
  identity; unchanged persisted vocabulary, wrong bank, revision, XP/history.
- Changed word/action/correctness: 409; property-order/normalized-mode replay
  succeeds; attacker-controlled stats/revision fields have no effect.
- Stale Good and Again: a new operation ID returns `REVIEW_NOT_DUE`, unchanged
  state and one ledger row. Null scheduling is not due.
- Concurrent same payload, conflicting payload, and two distinct due-review IDs:
  one learning mutation. Concurrent Known/Hard retry: one mutation. Concurrent
  global UUID reuse by two owners: one winner, one 409, rollback for loser.
- Cross-user operation replay/reuse returns no outcome; foreign-word requests
  fail independently. Forced persistence failure rolls back learning, wrong
  bank and revision. Deletion and later wrong-bank clearing remain respected.
- Chromium exercises lost-response automatic/manual retry, two stale sessions,
  new Known/Hard clicks after completion, account switches, stale queues and
  replacement Review sessions. Existing quiz protection is retained.

## Verification

Local verification on 2026-08-28 (no deployment):

| Gate | Result |
| --- | --- |
| Before-fix characterization | 4/4 reproduced double mutation before production edits |
| Focused backend | 50/50: review security 23, spaced repetition 8, Findings 5-9 3, quiz attempts 11, schema 5 |
| Maven `clean verify` | 158/158 in 27 suites; 0 failures/errors/skips |
| Maven `-DskipTests package` | PASS after verify |
| JaCoCo | Lines 2634/2980 = 88.39%; branches 768/1211 = 63.42%; 80% line gate PASS |
| Focused Chromium | 13/13 (11 new 12C cases plus 2 existing review/command cases) |
| Full Chromium | 105/105, including existing quiz replay/410/pending-local-progress and account-isolation coverage |
| Frontend syntax | 25/25 JavaScript files |
| Helpers | 8/8 suites; review-operation helper 12/12 cases |
| ESLint / static build | PASS, no new suppressions |
| CSS asset guard | 10 stylesheets PASS |
| Inline-style ratchet | 27 usages / 9 files PASS |
| Docs drift | 31 controller routes / 32 environment keys / V7 PASS |
| Secret scan / `git diff --check` | PASS |

PostgreSQL evidence: portable **16.14** from EDB, disposable data directory
under ignored `release-gate-artifacts/finding12c-pg16`, listening only at
`127.0.0.1:55436`. Docker was unavailable; no Docker repair or remote DB was
used. Fresh prod-profile Flyway V1→V7 plus Hibernate `ddl-auto=validate` passed
`QuizApplicationTests` **1/1**. After actual database restart, repeat app startup
and Hibernate validation passed **1/1**, at V7 with no migration necessary.
All seven Flyway history rows succeeded. V7 checksum: **-1088142411**; V6 remains
**-1273792706**. The database was stopped after verification; no service was
installed. The ignored portable runtime/data remain available for review.

Logs are in ignored `release-gate-artifacts/finding12c-*.log`; the clean verify
coverage report is `backend/target/site/jacoco/index.html`. V1-V6 have no diff.
Audit artifact hashes match the original baseline and all three remain untracked.

## Remaining debt and review gate

Finding 12 status: **PARTIALLY FIXED — SECURITY REPLAY PATHS FIXED, RETENTION CLEANUP REMAINS**.
It must not be marked fully FIXED. Seven-day consumed-quiz-attempt
physical cleanup is still **not implemented**. Review-operation physical
age-based cleanup is also deferred to that same Finding 12 lifecycle batch;
its expiration/recovery window must be reviewed before deleting identities.
No scheduler or implicit age-based deletion exists in 12C.

Required version-skew sequence is documented in `DEPLOYMENT.md`: backend/V7
first, then frontend/cache refresh. Old clients without operation IDs fail
closed; new retrying clients must not be served against an old insecure backend.
This documents a future rollout, not authorization to begin Finding 13.

The three audit artifacts remain untouched and untracked; no exploit proof is
added. Commit/push was separately authorized after review. Retention cleanup,
Finding 13, and deployment remain out of scope.

## Pre-approval git status --short

At the completed verification boundary, nothing was staged and HEAD remained
the approved Batch 12B.1 commit. This records the reviewed Batch 12C scope;
after the approved commit, only the three audit artifacts should remain visible.

```text
 M .ai/completed-tasks.md
 M .ai/pending-tasks.md
 M .ai/project-state.md
 M backend/src/main/java/com/quizapp/review/MarkKnownRequest.java
 M backend/src/main/java/com/quizapp/review/ReviewAnswerRequest.java
 M backend/src/main/java/com/quizapp/review/ReviewAnswerResponse.java
 M backend/src/main/java/com/quizapp/review/SpacedRepetitionService.java
 M backend/src/main/java/com/quizapp/shared/GlobalExceptionHandler.java
 M backend/src/test/java/com/quizapp/AuditFindingsFiveToNineTests.java
 M backend/src/test/java/com/quizapp/DatabaseSchemaTests.java
 M backend/src/test/java/com/quizapp/SpacedRepetitionTests.java
 M database/schema.sql
 M docs/API.md
 M docs/DATABASE.md
 M docs/DEPLOYMENT.md
 M docs/TESTING.md
 M docs/product.md
 M frontend/index.html
 M frontend/js/app.js
 M frontend/js/review-today.js
 M frontend/js/storage.js
 M frontend/js/vocab.js
 M package.json
 M tests/smoke.spec.js
?? backend/src/main/java/com/quizapp/review/ReviewOperation.java
?? backend/src/main/java/com/quizapp/review/ReviewOperationConflictException.java
?? backend/src/main/java/com/quizapp/review/ReviewOperationOutcome.java
?? backend/src/main/java/com/quizapp/review/ReviewOperationRepository.java
?? backend/src/main/resources/db/migration/V7__add_review_operations.sql
?? backend/src/test/java/com/quizapp/Finding12ReviewOperationTests.java
?? docs/FINDING12C.md
?? docs/full-project-audit.docx
?? docs/full-project-audit.md
?? frontend/js/review-operation-client.js
?? full-project-audit.docx
?? scripts/frontend-review-operation-client.test.mjs
```
