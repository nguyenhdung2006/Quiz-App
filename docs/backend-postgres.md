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

Apply the manual schema once:

```powershell
psql -d quizapp -f ..\database\schema.sql
```

Then run:

```powershell
$env:DATABASE_URL="jdbc:postgresql://localhost:5432/quizapp"
$env:DATABASE_USERNAME="postgres"
$env:DATABASE_PASSWORD="your_password"
$env:JPA_DDL_AUTO="validate"
.\mvnw.cmd spring-boot:run
```

For fast development without manual schema validation, leave `JPA_DDL_AUTO` unset and Spring will use `update`.

## API Endpoints
All app APIs require an authenticated Google session except the OAuth/login routes.

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

## Stored Backend Features
The backend stores vocabulary words, word stats, wrong bank entries, quiz history, quiz answers, achievements, and unlocked achievements. `next_review` is used for spaced repetition.

## Verification
Run backend tests from `backend`:

```powershell
.\mvnw.cmd test
```
