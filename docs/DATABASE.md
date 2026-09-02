# Database

## Source Of Truth

Production schema changes are versioned only through Flyway migrations under:

```text
backend/src/main/resources/db/migration
```

Current migrations:

| Version | File | Purpose |
| --- | --- | --- |
| V1 | `V1__baseline_schema.sql` | Creates the baseline PostgreSQL schema, indexes, triggers, and achievement seed rows for a clean database. |
| V2 | `V2__add_sync_revision.sql` | Adds `app_users.sync_revision BIGINT NOT NULL DEFAULT 0` additively. |
| V3 | `V3__add_word_uid_and_word_tombstones.sql` | Adds stable `vocabulary.word_uid`, backfills it deterministically, enforces unique `(user_id, word_uid)`, and creates `word_tombstones`. |
| V4 | `V4__add_legacy_word_id_to_word_tombstones.sql` | Adds nullable `word_tombstones.legacy_word_id` and an index for legacy-device anti-resurrection matching. |
| V5 | `V5__add_quiz_attempts.sql` | Adds owned, UUID-addressed quiz attempts and bounded issued items/outcome metadata for transactional at-most-once submit and idempotent retry. |
| V6 | `V6__capture_quiz_attempt_achievement_xp.sql` | Adds immutable awarded-achievement XP to consumed attempt outcomes so exact replay preserves the complete original reward result. |

| V7 | `V7__add_review_operations.sql` | Bounded insert-only, owned review-operation outcomes and canonical fingerprints; no response snapshots. |

Do not edit an already-applied migration. Future schema changes must use a new `V8__...sql` or later migration. Batch 12C leaves V1-V6 unchanged.

## Review operation persistence

`review_operation` has a global UUID primary key, owner FK, original word ID,
validated action, 64-character SHA-256 fingerprint, creation/consumption times,
and original mastery/streak/next-review/message/resulting revision. All outcome
fields are non-null and bounded; no issued/partial row or JSON blob is stored.
The application has only lookup/INSERT operations and an immutable entity,
never merge/upsert/update. The existing user `PESSIMISTIC_WRITE` lock covers
lookup, due validation, mutation, revision increment and insertion through commit.
A global UUID insertion collision rolls the losing transaction back entirely.

A nullable composite `(target_word_id,target_user_id)` FK enforces vocabulary
ownership. Word deletion nulls only that live reference; the immutable original
word ID/outcome survives for retry. Owner deletion cascades ledger rows. Indexes
on owner/live word support FK deletion checks; replay reads use the UUID PK.
TIMESTAMPTZ values follow existing conventions (microsecond server timestamps).
Flyway runs V7 once; repeat startup validates its recorded checksum, rather
than re-executing CREATE TABLE. `database/schema.sql` mirrors V7.

Physical age-based cleanup is **not implemented** for review operations.
Coordinate it with the later Finding 12 retention batch: retain retry identities
through the approved recovery window, define expiration/retry behavior before
deletion, and use bounded cleanup. No scheduler or implicit deletion is added.

## Quiz Attempt Persistence

`learning_attempt` stores an unpredictable UUID, owning user, `QUIZ` type,
issued/consumed status, quiz configuration, creation/24-hour expiry/consumption
timestamps, a SHA-256 canonical submission fingerprint, original resulting
sync revision, quiz-history reference, and bounded immutable quiz/achievement
XP metadata.
It does not store a snapshot or JSON response blob.
V6 backfills the newly introduced achievement-XP breakdown as zero for attempts
already consumed under V5, which did not capture that breakdown. This is a
compatibility default, not a reconstruction of historical achievement XP or a
new reward grant. Attempts consumed under V6 capture the actual awarded value.

`learning_attempt_item` stores the owned vocabulary reference, ordinal,
`eng`/`vie` direction, and the immutable prompt/correct-answer context captured
when the attempt was issued. Composite foreign keys bind items to the same
attempt owner and vocabulary owner. Unique constraints reject duplicate
ordinals and duplicate words within one attempt. A word deleted before submit
leaves the captured context but clears the word reference, causing submit to
fail closed rather than mutating a deleted/different word.

Consumed-attempt retention has an approved target of seven days. Batch 12B
records the required timestamps but does not yet run physical cleanup; no
scheduler or implicit lazy deletion is claimed. Cleanup remains a later bounded
Finding 12 lifecycle task.

## Stable Word Identity And Tombstones

`vocabulary.id` remains the numeric primary key. `vocabulary.word_uid UUID NOT NULL` is the cross-device logical identity for sync and has a unique constraint on `(user_id, word_uid)`.

`word_tombstones` stores delete facts independently of `vocabulary`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Primary key. |
| `user_id` | `BIGINT` | FK to `app_users(id)` with cascade on user delete. |
| `word_uid` | `UUID` | Deleted logical word identity. |
| `legacy_word_id` | `BIGINT` | Nullable old numeric `vocabulary.id` captured at delete time so upgraded legacy clients can match tombstones even if they never adopted server `wordUid`. |
| `deleted_at` | `TIMESTAMPTZ` | Server deletion timestamp. |
| `deleted_revision` | `BIGINT` | Server revision that introduced the tombstone; constrained `>= 0`. |

Constraints and indexes:

- `ux_word_tombstones_user_word_uid` unique on `(user_id, word_uid)`.
- `idx_word_tombstones_user_revision` on `(user_id, deleted_revision)`.
- `idx_word_tombstones_user_legacy_word_id` on `(user_id, legacy_word_id)`.
- No FK from `word_tombstones.word_uid` to `vocabulary`; deletes are hard deletes, not soft deletes.

## Finding 10 Query Notes

- Review queues with a positive `limit` calculate the existing priority order
  and apply the row limit in the repository query. The existing
  `word_stats(next_review)` index supports due-date filtering; no new index was
  justified by the local H2 benchmark.
- Learning progress uses database counts/weekly aggregates rather than loading
  vocabulary and quiz-history entity collections.
- Full snapshot and analytics responses still scale with the user's retained
  data. No pagination, retention cleanup, index migration, or schema change was
  introduced by Finding 10.

H2 results are application-level before/after evidence only. Any future index
proposal must include a PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` or equivalent
production-like plan and pass the database migration Risk Gate first.

## Production Runtime Policy

Production must run with:

```text
SPRING_PROFILES_ACTIVE=prod
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.enabled=true
spring.flyway.validate-on-migrate=true
spring.flyway.clean-disabled=true
spring.flyway.baseline-on-migrate=false
```

`ProductionDatabaseSafetyGuard` fails startup when the `prod` or `production` profile is active and the effective values are unsafe. This protects production from Hibernate schema mutation, disabled Flyway, accidental baseline-on-migrate, or Flyway clean.

## `database/schema.sql`

`database/schema.sql` is a reference snapshot and legacy manual repair script. It is not the production migration source of truth. It contains idempotent `CREATE TABLE IF NOT EXISTS`, additive repair `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, trigger recreation, and achievement upsert statements that are useful for inspection or local manual repair but are not equivalent to the ordered Flyway history.

## Existing Database Baseline

For an existing production or staging database, do not run migrations blindly:

1. Export schema and back up data.
2. Compare tables, columns, constraints, indexes, triggers, and seed rows against V1 and V2.
3. Confirm whether `flyway_schema_history` already exists.
4. If the database is non-empty and has no Flyway history, create the baseline marker deliberately through a controlled DBA/Flyway maintenance action.
5. Do not deploy the production application with `baseline-on-migrate=true`; the guard rejects it.
6. Restart with `SPRING_PROFILES_ACTIVE=prod` and confirm Hibernate validation passes.

No production baseline or migration was executed by this repository change.

## Release Gate Database Controls

The production release gate rehearses Flyway against a temporary PostgreSQL database, not production. It verifies:

- migrations validate;
- migrations run from the beginning on a clean database;
- production-like profile uses Flyway enabled and Hibernate `ddl-auto=validate`;
- repeated startup reports the schema up to date rather than mutating through Hibernate;
- duplicate Flyway migration versions fail source-integrity checks.

Production backup and restore rehearsal remain external controls. They must be evidenced before a release can be `GO`.
