# Backend And PostgreSQL Guide

## Run Backend Locally
From `backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

Default mode uses H2 memory database so the API can run immediately.

## Run With PostgreSQL
Create the database:

```sql
CREATE DATABASE quizapp;
```

Then run:

```powershell
$env:DATABASE_URL="jdbc:postgresql://localhost:5432/quizapp"
$env:DATABASE_USERNAME="postgres"
$env:DATABASE_PASSWORD="your_password"
$env:JPA_DDL_AUTO="validate"
.\mvnw.cmd spring-boot:run
```

The manual schema is in `database/schema.sql`. Run it once before starting the backend with `JPA_DDL_AUTO=validate`.

## API Endpoints
Words:

- `GET /api/v1/words`
- `POST /api/v1/words`
- `PUT /api/v1/words/{id}`
- `PATCH /api/v1/words/{id}/favorite`
- `DELETE /api/v1/words/{id}`

Wrong bank:

- `GET /api/v1/wrong-words`
- `POST /api/v1/wrong-words`
- `PATCH /api/v1/wrong-words/{id}/mastered`
- `DELETE /api/v1/wrong-words/{id}`
- `DELETE /api/v1/wrong-words/mastered`

Google login is intentionally not built yet. The backend currently permits `/api/**` so the app can be developed first, then OAuth can be added cleanly.
