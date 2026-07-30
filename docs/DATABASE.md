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

Do not edit an already-applied migration. Future schema changes, including tombstone support, must use a new `V3__...sql` or later migration.

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
