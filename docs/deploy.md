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
| `SPRING_PROFILES_ACTIVE` | Production yes | Use `prod`. The alias `production` activates the `prod` profile group. |
| `DATABASE_URL` | Production yes | JDBC URL, for example `jdbc:postgresql://HOST:5432/DB`. Local can omit for H2. If using Supabase pooler (port 6543), append `?prepareThreshold=0` (or `&prepareThreshold=0` if other params exist) to prevent PgBouncer prepared-statement errors. |
| `DATABASE_USERNAME` | Production yes | PostgreSQL username. |
| `DATABASE_PASSWORD` | Production yes | PostgreSQL password. |
| `JPA_DDL_AUTO` | Optional | Local default path can use `update`. Production profile pins the effective value to `validate`; unsafe overrides fail startup. |
| `FLYWAY_ENABLED` | Optional | Local default is `false`. Production profile pins the effective value to `true`; unsafe overrides fail startup. |
| `FLYWAY_BASELINE_ON_MIGRATE` | Optional | Must be `false` for application production startup. If an existing database needs a baseline marker, perform that as a separately approved maintenance action, not as steady-state app config. |
| `FLYWAY_BASELINE_VERSION` | Optional | Defaults to `1` for an existing verified schema baseline. Do not change without a reviewed baseline decision. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret. |
| `FRONTEND_URL` | Production yes | Public frontend origin, for example `https://YOUR_FRONTEND_DOMAIN`. |
| `BACKEND_URL` | Frontend deploy yes | Public backend origin for frontend config. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated frontend origins. Defaults to `FRONTEND_URL` or local origins. |
| `OAUTH_SUCCESS_REDIRECT_URI` | Optional | Override success redirect if needed. |
| `OAUTH_LOGOUT_REDIRECT_URI` | Removed | Logout now uses `POST /logout` with CSRF and returns `204`; the frontend redirects to `login.html?loggedOut=true`. |
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

### Supabase Pooler / PgBouncer

Supabase uses PgBouncer in transaction mode on port 6543. PgBouncer transaction
mode conflicts with PostgreSQL JDBC server-side prepared statements, causing:

```text
ERROR: prepared statement "S_1" does not exist
```

Fix: append `?prepareThreshold=0` to `DATABASE_URL`:

```text
jdbc:postgresql://<supabase-pooler-host>:6543/postgres?prepareThreshold=0
```

If the URL already has query parameters, use `&` instead of `?`:

```text
jdbc:postgresql://<supabase-pooler-host>:6543/postgres?sslmode=require&prepareThreshold=0
```

This disables server-side prepared statement caching, which is safe for
transaction-mode PgBouncer. Always verify this parameter is present after any
`DATABASE_URL` change.

### Missing Production Column

Production Supabase must have `app_users.sync_revision` (bigint, default 0).
This column is created by JPA `ddl-auto=update` on fresh databases but was
missing on existing Supabase instances. Manual SQL:

```sql
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0;
```

Verify:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'app_users'
  AND column_name = 'sync_revision';
```

Expected:

```text
sync_revision | bigint | NO | 0
```

Any future entity/schema change must have a planned migration or manual SQL
before deploying with `JPA_DDL_AUTO=validate`.

### Flyway Migration

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

See `docs/flyway-baseline-strategy.md` for the full staged production plan.
The production application profile refuses `baseline-on-migrate=true`; any
existing-database baseline marker must be created through a controlled
maintenance action after backup and rehearsal.

Minimum production database env after verification:

```text
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL=jdbc:postgresql://HOST:5432/quizapp
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
```

`backend/src/main/resources/application-prod.yml` supplies:

```text
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.enabled=true
spring.flyway.validate-on-migrate=true
spring.flyway.clean-disabled=true
spring.flyway.baseline-on-migrate=false
```

`ProductionDatabaseSafetyGuard` also checks the effective runtime values and
fails startup when the `prod` or `production` profile is active with unsafe
database settings.

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

Actuator metrics remain exposed by Actuator config for operator visibility, but
they are not public anonymous endpoints:

```text
GET /actuator/metrics
GET /actuator/metrics/**
```

`SecurityConfig` requires an authenticated session for metrics and returns
`401` to anonymous callers. Production scraping must use an operator-controlled
session, private network, or future token/allowlist mechanism. Do not expose
`env`, `beans`, `mappings`, `heapdump`, `configprops`, or `threaddump` in
production.

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

## Production Incident Fixes

This section documents production incidents that were resolved. Read this before
deploying or debugging similar issues.

### 1. Missing `app_users.sync_revision` Column

**Symptom:** Backend 500 errors on sync endpoints after initial production
deploy.

**Root cause:** Supabase (production database) was created before the
`sync_revision` column was added to the `AppUser` entity. JPA
`ddl-auto=validate` failed on startup because the column did not exist.

**Fix:** Manual SQL applied directly to Supabase:

```sql
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0;
```

**Prevention:** Any future entity/schema change must include a planned migration
or manual SQL. Do not rely on `ddl-auto=update` in production. After manual SQL
is applied, set `JPA_DDL_AUTO=validate` to catch future drift.

See `docs/flyway-baseline-strategy.md` for the staged Flyway rollout plan.

### 2. PgBouncer Prepared Statement Conflict

**Symptom:** Production endpoints returned 500 with:

```text
ERROR: prepared statement "S_1" does not exist
```

**Root cause:** Supabase pooler (PgBouncer in transaction mode on port 6543)
conflicts with PostgreSQL JDBC server-side prepared statement caching.

**Fix:** Append `?prepareThreshold=0` to `DATABASE_URL`.

**Prevention:** Check `DATABASE_URL` after every env change or pooler
configuration change. See "PostgreSQL Setup → Supabase Pooler / PgBouncer"
above for details.

### 3. Sync Paused First-Sync Deadlock

**Symptom:** Frontend showed "Sync paused to protect your data" on first login.
Sync never completed successfully.

**Root cause:** The stale-device guard in `frontend/js/app.js` blocked `/api/sync`
when a cloud snapshot had been pulled but `lastSuccessfulSyncAt` was still null
(first sync). Old logic:

```js
if (!lastSync) return cloudUpdated > 0;
```

This returned `true` (stale) whenever the cloud had any data — even on first
sync with no prior successful sync.

**Fix:** Changed to:

```js
if (!lastSync) return false;
```

**What this does NOT disable:**
- 7-day stale guard (still active for devices older than 7 days)
- `sync_revision` / 409 conflict protection
- Pull-before-push ordering
- Delete queue blocking

The fix only permits the first sync to proceed, after which the normal stale
guard and conflict mechanisms provide protection.

### 4. GitHub Secret Audit

**Result:** No real `.env` files were committed to the repository.

- Tracked env files are only: `.env.example` and `backend/.env.example`.
- Git history search for real env file commits returned no matches.
- GitHub Secret Protection / Push Protection are enabled on the repository.
- Do **not** commit real `.env` files.
- Do **not** screenshot Render, Supabase, or Google Cloud secret pages.

### 5. Production Smoke Test (June 9, 2026)

Public endpoints verified after fixes:

```text
https://wordarena.org/               PASS — full app loads
https://wordarena.org/index.html      PASS
https://wordarena.org/login.html      PASS
GET /api/health                       PASS — {"status":"ok","app":"quiz-app"}
GET /api/health/summary               PASS — all 8 counters at 0, uptime ~15min
GET /api/me (unauthenticated)         PASS — {"authenticated":false}
GET /api/snapshot                     PASS — redirects to Google OAuth
GET /api/review/queue                 PASS — redirects to Google OAuth
GET /api/analytics/overview           PASS — redirects to Google OAuth
```

Authenticated browser smoke test should be run manually after any major deploy:
login, dashboard, vocabulary add/delete, reload, review, analytics, AI deck,
and final sync status `Synced`.

### 6. Future Deploy Checklist

Before each deploy:

- [ ] Schema changes applied or migration exists
- [ ] `DATABASE_URL` includes `prepareThreshold=0` (if using Supabase pooler)
- [ ] No real `.env` files tracked
- [ ] `git status --short` is clean
- [ ] Backend tests pass: `.\mvnw.cmd test`
- [ ] Frontend smoke tests pass: `npx playwright test`

After each deploy:

- [ ] `GET /api/health` returns 200
- [ ] `GET /api/health/summary` returns counters
- [ ] Sign in with Google works
- [ ] `GET /api/me` shows authenticated user
- [ ] Dashboard loads
- [ ] Vocabulary loads and add/delete works
- [ ] Sync status shows `Synced`
- [ ] Review Today loads
- [ ] Analytics loads
- [ ] AI Deck safe behavior (fallback or rate limited)
- [ ] `GET /api/health/summary` counters near 0
- [ ] Backend logs show clean startup, no secrets

## Production Smoke Checklist

### Before Deploy

- Confirm schema changes are applied or a migration exists.
- Confirm `DATABASE_URL` still includes `prepareThreshold=0` if using Supabase pooler.
- Confirm no real `.env` files are tracked (`git status --short` clean for env files).
- Confirm Git status is clean: `git status --short`.
- Run backend tests: `cd backend && .\mvnw.cmd test`.
- Run frontend smoke tests: `npx playwright test` (or equivalent).

### After Deploy — Quick

1. `GET /api/health` — confirm HTTP 200 with `{"status":"ok","app":"quiz-app"}`.
2. `GET /api/health/summary` — confirm JSON with `uptimeSeconds` and all 8 counters.
3. `GET /actuator/health` — confirm HTTP 200 with `{"status":"UP"}`.
4. `GET /actuator/info` — confirm app name, environment, AI/Flyway flags safe.
5. Open the frontend URL and confirm the app shell loads.
6. `GET /api/me` — confirm `{"authenticated":false}` when unauthenticated.
7. Anonymous `GET /actuator/metrics` — confirm HTTP `401`; authenticated
   operator access may inspect operational metric names, labels, and values.

### After Deploy — Authenticated Browser

1. Sign in with Google and confirm `/api/me` shows the expected user.
2. Confirm Dashboard loads with correct word/review counts.
3. Confirm Vocabulary list loads and displays saved words.
4. Add one test word, refresh, confirm sync status shows `Synced`.
5. Delete the test word, refresh, confirm sync status still healthy.
6. Run a small quiz and confirm the result saves locally and on cloud.
7. Open Review Today and confirm the queue loads without console errors.
8. Open Analytics and confirm charts/reports render.
9. Try AI Explain or AI Deck. With no `OPENAI_API_KEY`, confirm fallback UX appears. With a key, confirm rate limits still apply.
10. Check `/api/health/summary` — confirm counters did not increase unexpectedly (all should be 0 or near-0 after quick smoke).
11. Check backend logs for the startup summary and absence of secret values.
12. Remove any smoke test words created during verification.

## Public Beta Smoke Checklist

Before inviting a small beta group:

1. Run backend tests: `cd backend` then `.\mvnw.cmd test`.
2. Run frontend checks: recursive `node --check frontend/js/*.js` and `npm run test:frontend`.
3. Open the production frontend and confirm the beta label, footer, feedback link, and issue-report link are visible.
4. Confirm the feedback links go only to the public GitHub issue flow and do not include user data.
5. Confirm the frontend source does not contain API keys, database URLs, OAuth secrets, or private tokens.
6. Open `https://YOUR_BACKEND_DOMAIN/actuator/health` and confirm `status: UP`.
7. Open `https://YOUR_BACKEND_DOMAIN/actuator/info` and confirm it exposes only safe app, AI, and Flyway metadata.
8. Open `https://YOUR_BACKEND_DOMAIN/actuator/metrics` without a session and confirm it returns `401`; use authenticated operator access only for metric inspection.
9. Sign in with Google, add one temporary word, refresh, and confirm sync status looks healthy.
10. Run one quiz and confirm result/review state updates without console errors.
11. Open Review Today and confirm due/empty states are clear.
12. Open AI Deck and confirm users see the reminder to review/edit AI suggestions before saving.
12. Test AI Deck and AI Explain. If `OPENAI_API_KEY` is unavailable or rate limited, confirm fallback/error copy is safe.
13. Check the app at desktop, tablet, and 390px mobile width for no horizontal overflow.
14. Remove any temporary beta-test vocabulary created during the smoke test.

## Troubleshooting

PgBouncer / Supabase pooler error:

```text
ERROR: prepared statement "S_1" does not exist
```

- Check `DATABASE_URL` includes `?prepareThreshold=0` (or `&prepareThreshold=0`
  if other query params exist).
- This is required for Supabase pooler (transaction-mode PgBouncer on port 6543).
- See "PostgreSQL Setup → Supabase Pooler / PgBouncer" above.

`app_users.sync_revision` column missing:

- Backend fails to start or sync returns 500.
- Verify with the SQL query in "PostgreSQL Setup → Missing Production Column".
- Apply the `ALTER TABLE` SQL if the column is missing.

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
# Sync V2 Deployment Note

Before deploying this change, apply Flyway migrations through V4 in staging/production with `SPRING_PROFILES_ACTIVE=prod`, `spring.flyway.enabled=true`, and `spring.jpa.hibernate.ddl-auto=validate`.

Client/server compatibility is strict: deployed frontends must send `syncContractVersion: 2`, `wordUid` for every sync vocabulary item, and `deletions` for pending deletes. Legacy clients that omit the contract version receive `400 SYNC_CLIENT_UPGRADE_REQUIRED` and must be refreshed/upgraded.

No manual tombstone cleanup job is included. Tombstones are retained to protect multi-device delete integrity.

Render backend deploy must set `SPRING_PROFILES_ACTIVE=prod` or equivalent safe env values. If logs show `No active profile set` while `JPA_DDL_AUTO=validate` is active and Flyway is not active, Hibernate can fail startup before the V3/V4 schema exists.
