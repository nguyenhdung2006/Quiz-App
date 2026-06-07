# Deploy Guide

This guide prepares Quiz App for a public deployment without committing secrets.

## Local Run

Backend:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The backend defaults to an H2 in-memory database when PostgreSQL environment
variables are not set.

Frontend:

Use VS Code Live Server or any static server and open:

```text
http://localhost:5500/frontend/login.html
```

The frontend defaults to the backend at:

```text
http://localhost:8080
```

## Production Architecture

Recommended beginner-friendly setup:

- Backend: Render, Railway, Fly.io, or another Java host.
- Database: managed PostgreSQL.
- Frontend: Vercel, Netlify, static hosting, or the same host if preferred.
- OAuth: Google OAuth must include both local and production redirect URLs.

Do not deploy real secrets in the repository. Set them only as environment
variables in the hosting platform.

## Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Production yes | JDBC URL, for example `jdbc:postgresql://HOST:5432/DB`. Local can omit for H2. |
| `DATABASE_USERNAME` | Production yes | PostgreSQL username. |
| `DATABASE_PASSWORD` | Production yes | PostgreSQL password. |
| `JPA_DDL_AUTO` | Production yes | Use `validate` after schema is created. Local can omit for `update`. |
| `FLYWAY_ENABLED` | Optional | Defaults to `false`. Set to `true` only for a verified PostgreSQL database or a fresh database that should run migrations. |
| `FLYWAY_BASELINE_ON_MIGRATE` | Optional | Defaults to `false`. Do not enable unless intentionally baselining an existing verified database. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret. |
| `FRONTEND_URL` | Production yes | Public frontend origin, for example `https://YOUR_FRONTEND_DOMAIN`. |
| `BACKEND_URL` | Frontend deploy yes | Public backend origin for frontend config. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated frontend origins. Defaults to `FRONTEND_URL` or local origins. |
| `OAUTH_SUCCESS_REDIRECT_URI` | Optional | Override success redirect if needed. |
| `OAUTH_LOGOUT_REDIRECT_URI` | Optional | Override logout redirect if needed. |
| `SESSION_COOKIE_SAME_SITE` | Production yes | Use `none` for Vercel frontend + Render backend. Local default is `lax`. |
| `SESSION_COOKIE_SECURE` | Production yes | Use `true` for HTTPS production. Local default is `false`. |
| `SESSION_COOKIE_PATH` | Optional | Defaults to `/`. |
| `APP_ENV` | Optional | Safe label shown by `/actuator/info`, for example `production`. |
| `APP_VERSION` | Optional | Safe release label shown by `/actuator/info`. |
| `OPENAI_API_KEY` | Optional | If missing, AI explain uses rule-based fallback. |
| `AI_MODEL` | Optional | Defaults to `gpt-4.1-mini`. |
| `AI_EXPLAIN_RATE_LIMIT_PER_MINUTE` | Optional | Defaults to `10`. Tune cautiously for public launches. |
| `AI_EXPLAIN_RATE_LIMIT_PER_DAY` | Optional | Defaults to `100`. |
| `AI_DECK_RATE_LIMIT_PER_MINUTE` | Optional | Defaults to `3`. |
| `AI_DECK_RATE_LIMIT_PER_DAY` | Optional | Defaults to `20`. |

Use `.env.example` or `backend/.env.example` as a template. Never commit `.env`.

## Google OAuth Setup

In Google Cloud Console, configure the OAuth client.

Authorized JavaScript origins:

```text
http://localhost:5500
https://YOUR_FRONTEND_DOMAIN
```

Authorized redirect URIs:

```text
http://localhost:8080/login/oauth2/code/google
https://YOUR_BACKEND_DOMAIN/login/oauth2/code/google
```

Set the backend environment variables:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN
CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
```

## PostgreSQL Setup

Flyway migration support is prepared but disabled by default. For a fresh
PostgreSQL database, enable Flyway and let it apply the baseline migration:

```text
DATABASE_URL=jdbc:postgresql://HOST:5432/quizapp
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
FLYWAY_ENABLED=true
JPA_DDL_AUTO=validate
```

The legacy `database/schema.sql` file remains a reference and manual repair
script for now. Do not run both `database/schema.sql` and Flyway V1 against the
same fresh database.

For an existing Supabase or production database, do not simply enable Flyway and
deploy. Use this safer rollout:

1. Back up/export the database schema.
2. Verify tables, columns, constraints, indexes, triggers, and seed data match
   `backend/src/main/resources/db/migration/V1__baseline_schema.sql`.
3. Check for schema drift, especially legacy tables created before later app
   fields existed.
4. Baseline the existing database deliberately so Flyway records the correct
   starting point without replaying V1 over populated tables.
5. Enable Flyway only after the baseline marker is correct.
6. Keep `JPA_DDL_AUTO=validate`.

Minimum production database env after verification:

```text
DATABASE_URL=jdbc:postgresql://HOST:5432/quizapp
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
FLYWAY_ENABLED=true
JPA_DDL_AUTO=validate
```

If the platform provides a PostgreSQL URL in a different format, convert it to a
JDBC URL before setting `DATABASE_URL`.

## Render Backend Deploy

Create a new Render Web Service.

Suggested settings:

```text
Root Directory: backend
Build Command: .\mvnw.cmd clean package -DskipTests
Start Command: java -jar target/quiz-0.0.1-SNAPSHOT.jar
Health Check Path: /actuator/health
```

On Linux-based Render services, use:

```text
Build Command: ./mvnw clean package -DskipTests
Start Command: java -jar target/quiz-0.0.1-SNAPSHOT.jar
```

Add the environment variables from the table above. Keep
`OPENAI_API_KEY` optional unless AI explanations should call OpenAI.

Set `APP_ENV=production` and optionally `APP_VERSION` to the release name so
`/actuator/info` can confirm which build is running without exposing secrets.

## Frontend Deploy

The frontend reads the backend base URL from `frontend/js/config.js`.

Local default:

```text
http://localhost:8080
```

For Vercel, Netlify, or another static host, override before app scripts load:

```html
<script>
window.QUIZ_APP_CONFIG = {
  apiOrigin: "https://YOUR_BACKEND_DOMAIN"
};
</script>
<script src="js/config.js"></script>
```

If your host serves static files as-is, you can edit the deployment copy of
`frontend/js/config.js` or inject the snippet above in the deployed HTML.

The backend CORS config must allow the frontend domain. Set:

```text
FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN
```

or:

```text
CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```

## Health And Monitoring

Public lightweight compatibility endpoint:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "app": "quiz-app"
}
```

This endpoint does not expose database, OAuth, or AI secrets.

Actuator endpoints exposed publicly:

```text
GET /actuator/health
GET /actuator/info
```

Only `health` and `info` are exposed. Do not expose `env`, `beans`,
`mappings`, `heapdump`, `configprops`, or `threaddump` in production.

Expected healthy response:

```json
{
  "status": "UP"
}
```

The health endpoint uses Spring Boot health indicators, including database
connectivity. If PostgreSQL is unavailable, the status should become `DOWN`.
Details are intentionally hidden from public responses.

Expected safe info response:

```json
{
  "app": {
    "name": "WordArena",
    "version": "0.0.1-SNAPSHOT",
    "environment": "production"
  },
  "ai": {
    "enabled": true
  },
  "flyway": {
    "enabled": true
  }
}
```

This response must never contain database URLs, passwords, OAuth secrets, API
keys, session settings, or stack traces.

Startup logs include a short safe summary:

```text
WordArena backend started: profiles=default, port=8080, aiEnabled=true, flywayEnabled=true
```

Use the log line to confirm the app reached `ApplicationReadyEvent` and to
verify AI/Flyway toggles without dumping configuration.

## AI Cost Guard

`OPENAI_API_KEY` is optional. Without it, the app still runs and AI Explain uses
the rule-based fallback.

Current protections:

- Backend AI endpoints have in-memory per-user rate limiting.
- Tune `AI_EXPLAIN_RATE_LIMIT_*` and `AI_DECK_RATE_LIMIT_*` with care.
- No AI response cache yet.
- Do not expose `OPENAI_API_KEY` in frontend code.

For a larger public launch, add shared rate limiting and caching in a later
sprint if the backend is scaled across multiple instances.

## Production Smoke Checklist

After each deploy:

1. Open `https://YOUR_BACKEND_DOMAIN/actuator/health` and confirm HTTP 200 with `status: UP`.
2. Open `https://YOUR_BACKEND_DOMAIN/actuator/info` and confirm app name, environment, AI enabled status, and Flyway enabled status are safe and correct.
3. Open the frontend URL and confirm the app shell loads.
4. Sign in with Google and confirm `/api/me` shows the expected user.
5. Add one test vocabulary word, refresh, and confirm sync still shows as healthy.
6. Run a small quiz and confirm the result saves locally/cloud when signed in.
7. Open Review and confirm the queue loads without console errors.
8. Try AI Explain or AI Deck. With no `OPENAI_API_KEY`, confirm fallback UX appears. With a key, confirm rate limits still apply.
9. Check backend logs for the startup summary and absence of secret values.

## Troubleshooting

OAuth redirect mismatch:

- Check Google OAuth redirect URI.
- It must match `https://YOUR_BACKEND_DOMAIN/login/oauth2/code/google`.

CORS error:

- Check `FRONTEND_URL` or `CORS_ALLOWED_ORIGINS`.
- The value must match the exact frontend origin.

Database connection fail:

- Check `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD`.
- Make sure the managed PostgreSQL instance allows the backend host.

H2 local vs PostgreSQL production:

- Local can run with no database env and uses H2.
- Flyway is disabled by default so PostgreSQL-specific migrations do not break
  H2 local/test startup.
- Production should use PostgreSQL, `FLYWAY_ENABLED=true` only after baseline
  verification, and `JPA_DDL_AUTO=validate`.

AI not configured:

- Missing `OPENAI_API_KEY` is expected to fall back safely.
- Set `AI_MODEL` only if you need a model other than the default.
