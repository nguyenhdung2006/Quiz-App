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
