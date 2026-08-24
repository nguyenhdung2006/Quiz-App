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

Do not edit an already-applied migration. Future schema changes must use a new `V5__...sql` or later migration.

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
