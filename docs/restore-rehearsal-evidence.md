# Restore Rehearsal Evidence

This file records the Wave 3 non-production restore rehearsal. It intentionally
does not include raw data, dumps, passwords, access tokens, or private
connection strings.

## Summary

| Field | Evidence |
| --- | --- |
| Rehearsal date/time | 2026-08-08T18:33:41Z |
| Operator | Codex local run at user request |
| Source backup reference | Not available; no sanitized backup/dump artifact was provided for this rehearsal |
| Source database alias | Repository Flyway migrations, not production Supabase |
| Target database | Disposable Docker PostgreSQL on `localhost:5433`, database `quiz_app_restore_rehearsal` |
| Restore command/tool | Spring Boot test startup with Flyway migrate and Hibernate validate; password supplied only through process env |
| Backup verification | NOT VERIFIED; no backup artifact was supplied or restored |
| Restore verification | PASS for schema/Flyway/app-start rehearsal on non-production PostgreSQL |
| Flyway/app verification | PASS: `QuizApplicationTests.contextLoads` with `SPRING_PROFILES_ACTIVE=prod`, Flyway enabled, and Hibernate `ddl-auto=validate` |
| Health smoke | NOT RUN; no restored app server was launched for `/api/health` |
| Rollback app path | See `docs/DEPLOYMENT.md` rollback app guidance |
| DB rollback/forward-fix policy | See `docs/DEPLOYMENT.md` database rollback and forward-fix policy |
| Result | PARTIAL PASS: schema/Flyway/app-start rehearsal succeeded; backup dump restore and health smoke remain not verified |

## Commands Used

The target was a disposable non-production PostgreSQL instance. The password was
passed only through a process-scoped environment variable and is omitted here.

```powershell
$env:SPRING_PROFILES_ACTIVE='prod'
$env:DATABASE_URL='jdbc:postgresql://localhost:5433/quiz_app_restore_rehearsal'
$env:DATABASE_USERNAME='postgres'
$env:DATABASE_PASSWORD='[REDACTED]'
$env:GOOGLE_CLIENT_ID='test-client-id'
$env:GOOGLE_CLIENT_SECRET='[REDACTED TEST VALUE]'
$env:FLYWAY_ENABLED='true'
$env:JPA_DDL_AUTO='validate'
$env:JAVA_TOOL_OPTIONS='-Duser.timezone=UTC'
.\mvnw.cmd -B -Dtest=QuizApplicationTests test
```

## Verified Output

- PostgreSQL target accepted connections on port `5433`.
- Flyway connected to `jdbc:postgresql://localhost:5433/quiz_app_restore_rehearsal`.
- Flyway validated 4 migrations.
- Flyway applied migrations through version `4 - add legacy word id to word tombstones`.
- Hibernate initialized with `ddl-auto=validate`.
- Spring Boot started with active profile `prod`.
- `QuizApplicationTests.contextLoads` completed with 1 test, 0 failures, 0 errors.
- Maven finished with `BUILD SUCCESS`.

## Limitations

- This repo does not currently contain an automated backup/dump restore command.
- No production Supabase database was touched.
- No sanitized backup/dump artifact was supplied, so this does not prove that a
  real backup can be restored.
- No app server was launched against the restored target, so `/api/health` was
  not smoked in this rehearsal.
- This evidence is enough to prove schema/Flyway/app-start rehearsal on the
  disposable target. It is not full production backup/restore readiness.
