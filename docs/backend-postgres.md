# Backend And PostgreSQL Guide

## Run Backend Locally
From `backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

Default mode uses an H2 in-memory database so the backend can start quickly for development.

## Run With PostgreSQL
Create the database:

```sql
CREATE DATABASE quizapp;
```

For a fresh PostgreSQL database, prefer Flyway:

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"
$env:DATABASE_URL="jdbc:postgresql://localhost:5432/quizapp"
$env:DATABASE_USERNAME="postgres"
$env:DATABASE_PASSWORD="your_password"
.\mvnw.cmd spring-boot:run
```

Flyway is disabled by default because the current baseline migration is
PostgreSQL-specific and the normal local/test path uses H2. Leave
`FLYWAY_ENABLED` unset for quick H2 development.

The `prod` profile loads `application-prod.yml`, which pins Hibernate to
`validate`, enables Flyway, validates migrations, disables Flyway clean, and
keeps `baseline-on-migrate=false`. Unsafe effective production settings fail
startup through `ProductionDatabaseSafetyGuard`.

The legacy `database/schema.sql` file remains as a reference and manual repair
script while migration rollout is staged. Do not apply `database/schema.sql` and
Flyway V1 to the same fresh database.

For an existing Supabase or production database, do not enable Flyway until the
database has been verified and baselined:

1. Back up/export the schema.
2. Compare tables, columns, constraints, indexes, triggers, and achievements
   seed data against `backend/src/main/resources/db/migration/V1__baseline_schema.sql`.
3. Check old manual repair gaps before trusting `JPA_DDL_AUTO=validate`.
4. Add the Flyway baseline marker intentionally.
5. Only then run with `SPRING_PROFILES_ACTIVE=prod`.

See `docs/flyway-baseline-strategy.md` for the staged production baseline
sequence. The production application profile refuses
`FLYWAY_BASELINE_ON_MIGRATE=true`; create any required existing-database
baseline marker through a controlled maintenance action after backup and
rehearsal.

If you intentionally need the old manual schema path for a local PostgreSQL
database, apply it before startup and keep Flyway disabled:

```powershell
psql -d quizapp -f ..\database\schema.sql
$env:DATABASE_URL="jdbc:postgresql://localhost:5432/quizapp"
$env:DATABASE_USERNAME="postgres"
$env:DATABASE_PASSWORD="your_password"
$env:JPA_DDL_AUTO="validate"
.\mvnw.cmd spring-boot:run
```

For fast development without manual schema validation, leave `DATABASE_URL`,
`FLYWAY_ENABLED`, and `JPA_DDL_AUTO` unset. Spring will use H2 with Hibernate
`update`.

## API Endpoints
Authentication is configured in `SecurityConfig`. Public endpoints are limited
to OAuth/login, preflight, lightweight health/CSRF/profile bootstrap, and the
safe actuator endpoints listed below. All other application endpoints require an
authenticated Google session; unsafe authenticated requests also require CSRF.

Public/bootstrap:

- `OPTIONS /**`
- `GET /oauth2/authorization/google`
- `GET /login/oauth2/code/google`
- `GET /api/health`
- `GET /api/health/summary`
- `GET /api/csrf`
- `GET /api/me` returns `{ "authenticated": false }` without a session
- `GET /actuator/health`
- `GET /actuator/info`
- `GET /actuator/metrics`
- `GET /actuator/metrics/{name}`

Public route identifiers tracked by the docs drift check: `/api/health`,
`/api/csrf`, `/api/me`, `/actuator/metrics`.

Profile:

- `GET /api/me`
- `PUT /api/profile`

Vocabulary:

- `GET /api/vocab`
- `POST /api/vocab`
- `PUT /api/vocab/{id}`
- `DELETE /api/vocab/{id}`

Learning:

- `GET /api/wrong-words`
- `GET /api/snapshot`
- `POST /api/sync`
- `POST /api/quiz-results`
- `GET /api/progress`
- `GET /api/achievements`
- `GET /api/quiz-history`

Sample import:

- `POST /api/admin/sample-words`

Review, analytics, and AI:

- `GET /api/review/today`
- `GET /api/review/queue`
- `POST /api/review/answer`
- `GET /api/analytics/overview`
- `GET /api/analytics/accuracy-trend`
- `GET /api/analytics/weak-words`
- `GET /api/analytics/review-pressure`
- `GET /api/analytics/tag-performance`
- `POST /api/ai/explain-wrong-answer`
- `POST /api/ai/generate-deck`

See `docs/API.md` for the method/path inventory, request bodies, status codes,
auth/public classification, and related test coverage.

## Stored Backend Features
The backend stores vocabulary words, word stats, wrong bank entries, quiz history, quiz answers, achievements, and unlocked achievements. `next_review` is used for spaced repetition.

## Verification
Run backend tests from `backend`:

```powershell
.\mvnw.cmd test
```

After starting against PostgreSQL, verify Actuator health:

```text
GET http://localhost:8080/actuator/health
```

Expected healthy response:

```json
{
  "status": "UP"
}
```

If the database is unreachable or `JPA_DDL_AUTO=validate` detects schema drift,
startup or health should fail before a production rollout is considered safe.
