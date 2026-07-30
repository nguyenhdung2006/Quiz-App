# Architecture Decisions

## ADR-001: Flyway Owns Production Schema

Status: Accepted

Production schema evolution is owned by Flyway migrations in `backend/src/main/resources/db/migration`. Hibernate must validate the schema in production and must not create, update, or drop schema objects.

Reasons:

- Hibernate `ddl-auto=update` can silently mutate production schema.
- Existing production history includes manual schema repair and potential drift.
- Flyway gives ordered, reviewable, repeatable schema changes before tombstone work.

Consequences:

- Production uses `application-prod.yml`.
- `ProductionDatabaseSafetyGuard` fails startup on unsafe effective production values.
- `database/schema.sql` remains documentation/reference only.
- Existing databases need backup, schema export, and a deliberate Flyway baseline strategy before steady-state migration rollout.

## ADR-002: Keep Local H2 Fast Path Separate

Status: Accepted

The default profile keeps H2 and Hibernate `update` for local quick startup. Production safety is enforced only when `prod` or `production` is active.

Reasons:

- Current developer workflow depends on zero-setup local backend startup.
- PostgreSQL-specific migrations should not break quick H2 tests.
- Production and local behavior must be explicit and documented.
# 2026-07-31: Sync Contract V2 Uses Stable UUID Identity And Tombstones

Decision: keep numeric `vocabulary.id` as the database primary key, add `vocabulary.word_uid UUID` as the logical sync identity, and store deletes in `word_tombstones` rather than soft-deleting vocabulary rows.

Rationale:

- Numeric IDs are not stable for offline-created words or cross-device sync.
- English text can change and must not be the Sync V2 identity.
- Tombstones allow stale devices to learn that a word was deleted even after the live row has been hard-deleted.

Rejected for this increment: CRDTs, vector clocks, event sourcing, tombstone garbage collection, and per-field merge. The product currently needs a single server-authoritative revision with pessimistic locking, not a distributed conflict-resolution system.
