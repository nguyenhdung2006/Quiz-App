# Flyway Baseline Strategy

## Summary

WordArena now has a conservative Flyway baseline strategy, but production Flyway rollout should remain staged. The production Supabase audit was manually verified before this plan: no normalized vocabulary duplicates, no orphan `word_stats`, no dangerous NULL corruption, no negative stats corruption, and review NULL timestamps are benign for new words. This means the project can prepare migration discipline, but it should still avoid any automatic production schema replay.

`app_users.sync_revision` is now represented by `V2__add_sync_revision.sql`. No tombstone table or tombstone column is part of this strategy.

## Current Schema Lifecycle

Current backend defaults:

- `spring.jpa.hibernate.ddl-auto=${JPA_DDL_AUTO:update}`
- `spring.flyway.enabled=${FLYWAY_ENABLED:false}`
- `spring.flyway.baseline-on-migrate=${FLYWAY_BASELINE_ON_MIGRATE:false}`
- Flyway migration directory: `backend/src/main/resources/db/migration`
- Current baseline file: `backend/src/main/resources/db/migration/V1__baseline_schema.sql`
- Current highest migration: `backend/src/main/resources/db/migration/V2__add_sync_revision.sql`
- Legacy manual schema file: `database/schema.sql`
- Production profile file: `backend/src/main/resources/application-prod.yml`

What this means:

- Local H2 development still boots quickly with Hibernate `update`.
- Production runs Flyway when `SPRING_PROFILES_ACTIVE=prod` is set.
- Existing production data is not automatically recreated or replayed.
- The app fails startup in the production profile if effective database settings are unsafe.

## Config Decisions

`backend/src/main/resources/application.properties` keeps Flyway disabled by default for local/H2, while `backend/src/main/resources/application-prod.yml` makes production safety explicit:

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
    validate-on-migrate: true
    clean-disabled: true
    baseline-on-migrate: false
```

Decision notes:

- Local `FLYWAY_ENABLED=false` keeps quick H2 startup unchanged.
- Production `spring.flyway.enabled=true` makes Flyway the schema owner.
- Production `spring.flyway.baseline-on-migrate=false` prevents accidental baselining.
- `baseline-version=1` matches the existing `V1__baseline_schema.sql`.
- `validate-on-migrate=true` keeps future migrations strict.
- `clean-disabled=true` blocks destructive Flyway clean behavior from application startup.
- `ProductionDatabaseSafetyGuard` rejects unsafe effective values when `prod` or `production` is active.

## Baseline Version

Use:

```text
V1__baseline_schema.sql
```

Interpretation:

- For a fresh PostgreSQL database, V1 can create the schema from scratch.
- For existing production Supabase, V1 represents the already-existing baseline and must not be replayed over populated tables.
- Future changes must start at V2.

Examples:

```text
V2__add_sync_revision.sql
V3__add_sync_revision_index.sql
```

## Environment Strategy

### Local H2 Development

Default:

```text
FLYWAY_ENABLED unset
JPA_DDL_AUTO unset
```

Expected behavior:

- H2 starts quickly.
- Hibernate uses default `update`.
- Flyway stays disabled.

### Fresh Local PostgreSQL

Use Flyway from the beginning:

```text
DATABASE_URL=jdbc:postgresql://localhost:5432/quizapp
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=...
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=false
JPA_DDL_AUTO=validate
```

Expected behavior:

- Flyway applies `V1__baseline_schema.sql`.
- Hibernate validates entity/schema compatibility.

### Staging Existing Database

Use staging to rehearse production baseline:

```text
DATABASE_URL=jdbc:postgresql://...
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=true
FLYWAY_BASELINE_VERSION=1
JPA_DDL_AUTO=validate
```

After the first successful startup creates `flyway_schema_history`, change:

```text
FLYWAY_BASELINE_ON_MIGRATE=false
```

Then restart and confirm the app still boots.

### Production Existing Supabase

Safest rollout:

1. Back up/export Supabase schema and data.
2. Confirm production audit findings remain clean.
3. Confirm `flyway_schema_history` state on a staging copy.
4. If an existing non-empty database has no Flyway history, create the baseline marker through a controlled DBA/Flyway maintenance action, not by deploying the application with `baseline-on-migrate=true`.
5. Confirm `flyway_schema_history` contains version `1`.
6. Start the application with the production profile:

```text
SPRING_PROFILES_ACTIVE=prod
```

7. Confirm `/actuator/health`, `/api/me`, `/api/snapshot`, `/api/review/queue`, and `/api/analytics/overview`.

Because `V2__add_sync_revision.sql` is already present, do not enable the production profile against an existing non-empty database until the baseline marker and current schema have been verified. If production already has `sync_revision` manually, V2 is additive and idempotent, but it still must be recorded by Flyway after baseline.

## Production Safety Protections

This strategy avoids:

- running V1 against existing production tables
- enabling Flyway in local/default H2 startup
- enabling baseline-on-migrate by default
- destructive Flyway clean
- adding `sync_revision` before baseline discipline exists
- relying on Hibernate `update` for future production schema changes

## Future Migration Discipline

Rules:

- Use one migration per small schema change.
- Keep migrations additive unless a manual data-cleanup plan exists.
- Never edit an already-applied migration.
- Name files clearly:

```text
V2__add_sync_revision.sql
V3__add_sync_revision_index.sql
V4__add_normalized_vocabulary_index.sql
```

- Test migrations on a copied/staging database before production.
- Keep `JPA_DDL_AUTO=validate` in production once baseline is established.
- Keep `FLYWAY_BASELINE_ON_MIGRATE=false` after the one-time baseline.
- Do not use `database/schema.sql` for production changes after Flyway is active.

## Remaining Risks

- Production `flyway_schema_history` does not exist until the one-time baseline step is executed.
- If production schema drifts after the manual audit and before baseline, `JPA_DDL_AUTO=validate` or Flyway validation may fail startup.
- `database/schema.sql` still exists as a legacy/manual repair reference. It should not be treated as the migration source of truth once Flyway is active.
- Normalized vocabulary uniqueness is still enforced in service logic, not by a normalized database unique index.
- Task 3 still needs a separate migration and concurrency design.

## Recommended Next Task

Next safest task:

```text
Task 7.1 - Stage Flyway baseline on a copied/staging Supabase database.
```

Only after staging proves clean startup should production run the one-time baseline marker and then start with `SPRING_PROFILES_ACTIVE=prod`. Tombstone work must be a later migration after V2.
