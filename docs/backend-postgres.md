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
CREATE DATABASE vocabulary_quiz;
```

Then run:

```powershell
$env:DATABASE_URL="jdbc:postgresql://localhost:5432/vocabulary_quiz"
$env:DATABASE_USERNAME="postgres"
$env:DATABASE_PASSWORD="your_password"
$env:SPRING_PROFILES_ACTIVE="postgres"
.\mvnw.cmd spring-boot:run
```

Optional manual schema is in `database/schema.sql`. Spring JPA can also create/update tables automatically while learning.

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
