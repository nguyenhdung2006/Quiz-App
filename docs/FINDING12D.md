# Finding 12D — bounded physical ledger retention

Prepared from base `6fc9c0c4dd001f11cc2b7a97c222bc61263f2411` on
`chore/audit-reconciliation-and-upgrade`. This batch has not been deployed. No
cloud or production database was accessed.

## Policy and eligibility

All comparisons are strict. At cleanup time `T`:

- consumed `learning_attempt`: delete only when `consumed_at < T - 7 days`;
- unconsumed `ISSUED`: its lifetime remains 24 hours, then delete only when
  `expires_at < T - 7 days`;
- accepted `review_operation`: delete only when `consumed_at < T - 7 days`.

Equality is retained. Attempt items disappear through the existing V5 parent
FK cascade. Quiz history is not a cleanup target. Exact attempt/operation replay
recovery is guaranteed only while its ledger entry is retained, not forever.
After review-ledger deletion, Review Today still rejects a stale non-due word.
Known/Hard already permit a genuinely new explicit intent; expiry of an old
identity does not add authority beyond using a fresh operation ID.

## Implementation boundary

V8 adds three portable indexes and changes no V1-V7 migration:

```text
learning_attempt(status, consumed_at, id)
learning_attempt(status, expires_at, id)
review_operation(consumed_at, id)
```

One pass selects UUIDs only, ordered by policy timestamp then ID, with a maximum
of 500 per category. Bulk deletes recheck status and cutoff. No entity, response
snapshot, answer, or full result set is materialized.

Successful attempt issuance/consumption and first-time review-operation writes
register an `afterCommit` callback. An atomic in-process throttle allows at most
one pass per hour per process. Cleanup executes through another bean with
`REQUIRES_NEW`; there is no self-invocation ambiguity and no scheduler. Failures
are logged by type and swallowed after the user transaction commits.

Cleanup is global maintenance, not authorization. It can remove eligible rows
for multiple users and never writes XP, learning stats, mastery, streak,
wrong-bank state, quiz history, or sync revision.

## Verification status

Focused retention/security, replay, review, spaced repetition, Findings 5–9,
and H2 schema coverage passes **61/61**. Maven `clean verify` passes **169/169**
tests in 29 suites with zero failures, errors, or skips; package passes.
JaCoCo reports **88.57% line coverage** (2704/3053) and **63.34% branch
coverage** (781/1233). The relevant Finding 12 Chromium suite passes **13/13**;
no production frontend file changed in this batch.

A disposable loopback-only PostgreSQL **16.14** cluster applied fresh Flyway
V1→V8: all eight history rows succeeded, V8 created the three cleanup
indexes, and Hibernate `ddl-auto=validate` passed. After an actual database
restart, Flyway validated all eight migrations, reported schema version 8 up to
date, and Hibernate validation passed again. The disposable server was stopped.
No cloud, staging, or production database was accessed.

The local PostgreSQL sanity fixture created 501 consumed attempts, 501 expired
issued attempts, 1,002 attempt items, 501 review operations, and 501 referenced
quiz histories. One pass selected and deleted exactly 500 IDs in each category;
two attempt items per selected attempt disappeared by FK cascade, leaving two
items total, while all 501 quiz histories remained. Observed category deletion
times were **0.940–3.068 ms**; the bounded consumed-ID selection returned 500
rows in **0.297 ms** without entity materialization. The deterministic H2 batch
test verifies a second pass removes the one remaining oldest-ordered row per
category.

Docs drift, secret scan, and `git diff --check` pass. V1–V7 are byte-unchanged
and V8 is the only new migration. The three audit artifacts remain untouched.

Human review approved Batch 12D and records **Finding 12 — FIXED**. Exact
replay-result recovery remains intentionally bounded by the seven-day ledger
retention window; this is not infinite idempotency storage. The batch has not
been deployed and no cloud/production database was accessed.
