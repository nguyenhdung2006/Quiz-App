# Flyway Baseline Rehearsal

## Summary

Task 7.5 was rehearsed locally against PostgreSQL Server 17 on this machine. Production Supabase was not touched. The rehearsal verified both important paths:

- Fresh database: Flyway applied `V1__baseline_schema.sql`, created schema, and Spring Boot started with `JPA_DDL_AUTO=validate`.
- Existing schema database: schema was loaded from `database/schema.sql`, sample rows were inserted, Flyway created a baseline marker at version `1`, and Spring Boot started without replaying V1 or dropping data.

Post-baseline startup with `FLYWAY_BASELINE_ON_MIGRATE=false` also succeeded.

## Environment

- Host: local Windows machine
- Database: local PostgreSQL Server 17.9
- User: `postgres`
- Production Supabase: not used
- Rehearsal directory: `backend/target/flyway-rehearsal-20260608_215945`

Disposable local databases:

- `wordarena_flyway_fresh_20260608_215945`
- `wordarena_flyway_existing_20260608_215945`

## Cleanup

Before continuing the rehearsal:

- Checked port `18081`: no listener.
- Checked for hanging `psql`: none remained.
- Reset the fresh rehearsal DB after an interrupted earlier attempt had already opened PostgreSQL sessions.
- Terminated 10 sessions connected only to `wordarena_flyway_fresh_20260608_215945`, then recreated that disposable DB.

No unrelated user process was killed.

## Execution Strategy

`Start-Process` was not used because Windows PowerShell was hitting `PATH`/`Path` duplicate environment issues and background process spawning could hang.

Instead, the rehearsal used a foreground Spring Boot context test:

```powershell
.\mvnw.cmd -Dtest=QuizApplicationTests test
```

This is sufficient for this rehearsal because it starts the Spring context, runs Flyway, lets Hibernate validate the schema, and exits without needing a long-running HTTP server.

The helper script used for the local rehearsal is:

```text
backend/target/flyway-rehearsal-20260608_215945/run-flyway-rehearsal.ps1
```

This script is under `target/` and is a local rehearsal artifact, not production runtime code.

## Phase B - Fresh Database Test

Database:

```text
wordarena_flyway_fresh_20260608_215945
```

Config:

```text
DATABASE_URL=jdbc:postgresql://localhost:5432/wordarena_flyway_fresh_20260608_215945
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<local password>
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=false
JPA_DDL_AUTO=validate
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
```

Result: PASS.

Important log lines:

```text
Schema history table "public"."flyway_schema_history" does not exist yet
Successfully validated 1 migration
Creating Schema History table "public"."flyway_schema_history" ...
Current version of schema "public": << Empty Schema >>
Migrating schema "public" to version "1 - baseline schema"
Successfully applied 1 migration to schema "public", now at version v1
WordArena backend started ... flywayEnabled=true
```

`flyway_schema_history`:

```text
installed_rank | version | description     | type | script                   | success
1              | 1       | baseline schema | SQL  | V1__baseline_schema.sql  | true
```

Fresh DB row counts after migration:

```text
achievements: 5
app_users: 0
vocabulary: 0
```

## Phase C - Existing Schema Baseline Rehearsal

Database:

```text
wordarena_flyway_existing_20260608_215945
```

Setup:

- Loaded `database/schema.sql`.
- Inserted one local rehearsal user.
- Inserted one vocabulary row.
- Inserted one `word_stats` row.

Config:

```text
DATABASE_URL=jdbc:postgresql://localhost:5432/wordarena_flyway_existing_20260608_215945
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<local password>
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=true
FLYWAY_BASELINE_VERSION=1
JPA_DDL_AUTO=validate
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
```

Result: PASS.

Important log lines:

```text
Schema history table "public"."flyway_schema_history" does not exist yet
Successfully validated 1 migration
Creating Schema History table "public"."flyway_schema_history" with baseline ...
Successfully baselined schema with version: 1
Current version of schema "public": 1
Schema "public" is up to date. No migration necessary.
WordArena backend started ... flywayEnabled=true
```

`flyway_schema_history`:

```text
installed_rank | version | description                                    | type     | script                                         | success
1              | 1       | Existing production schema baseline rehearsal | BASELINE | Existing production schema baseline rehearsal | true
```

Data preservation check after baseline:

```text
achievements: 5
app_users: 1
vocabulary: 1
word_stats: 1
```

No V1 replay occurred against the existing schema.

## Phase D - Post-Baseline Validation

Database:

```text
wordarena_flyway_existing_20260608_215945
```

Config:

```text
DATABASE_URL=jdbc:postgresql://localhost:5432/wordarena_flyway_existing_20260608_215945
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<local password>
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=false
FLYWAY_BASELINE_VERSION=1
JPA_DDL_AUTO=validate
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
```

Result: PASS.

Important log lines:

```text
Successfully validated 2 migrations
Current version of schema "public": 1
Schema "public" is up to date. No migration necessary.
WordArena backend started ... flywayEnabled=true
```

Data remained intact:

```text
achievements: 5
app_users: 1
vocabulary: 1
word_stats: 1
```

## JPA / Flyway Interaction

Findings:

- `JPA_DDL_AUTO=validate` succeeded in fresh and existing-schema rehearsal paths.
- Flyway ran before Hibernate validation as expected.
- No Hibernate schema mutation was observed in rehearsal configs.
- No checksum mismatch was observed.
- No validation mismatch was observed.
- No duplicate baseline attempt occurred after `FLYWAY_BASELINE_ON_MIGRATE=false`.

## Test Result

Full backend test suite:

```text
.\mvnw.cmd test
```

Result:

```text
BUILD SUCCESS
Tests run: 47, Failures: 0, Errors: 0, Skipped: 0
```

## Production Readiness Assessment

Production baseline is now lower risk, but should still be attempted later only under the staged plan:

1. Back up/export Supabase first.
2. Deploy with Flyway still disabled and `JPA_DDL_AUTO=validate`.
3. During a planned window, enable:

```text
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=true
FLYWAY_BASELINE_VERSION=1
JPA_DDL_AUTO=validate
```

4. Confirm `flyway_schema_history` has one baseline entry at version `1`.
5. Turn off baseline-on-migrate immediately:

```text
FLYWAY_BASELINE_ON_MIGRATE=false
```

6. Only then add future `V2__...` migrations.

Do not add `app_users.sync_revision` until the production baseline marker exists and post-baseline startup has been verified.
