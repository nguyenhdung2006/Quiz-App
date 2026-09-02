# Deployment And Rollback Runbook

This document complements `docs/deploy.md` with the release-gate-specific production handoff checklist.

## Frontend Entry Routing

Repository routing assumes the Vercel Root Directory is `frontend/`. Confirm
that setting before deployment and keep `frontend/vercel.json` in that directory
so `/` returns a temporary redirect to `/login.html`; `/login.html` remains the
public landing page and `/index.html` remains the explicit app entry used after
successful OAuth. If the project uses a different Root Directory, stop and move
or adapt the repository config through a reviewed deployment change rather than
creating an untracked dashboard-only rewrite.

After deploying a routing change, verify all three paths in a fresh browser
context. `/` and `/login.html` must show the Google login entry without rendering
the dashboard shell. A completed Google OAuth flow must still return to
`/index.html`. This repository change does not itself deploy or prove those
production results.

## Required Pre-Deployment Gate

### Finding 12C version-skew sequencing (future Finding 13 review only)

Apply and validate V7 with the new backend **before** serving the new frontend.
The new backend requires review `operationId`; cached old clients fail closed
with 400 until refreshed. Do not deploy the new retrying frontend against an
old backend, which has no idempotency boundary. Verify backend version/schema,
then invalidate frontend caches and check the explicit operation contract.
Do not roll back the backend to the insecure contract while the new frontend
is served. V1-V6 are immutable; roll-forward is preferred for this additive V7.
This is documentation only: Batch 12C performs no deployment or production DB
operation. Its implementation was separately approved for commit/push on
2026-09-02; that approval does not authorize rollout.

Run the GitHub Actions workflow **Production Release Gate** for the exact commit SHA intended for production. Do not deploy production unless the `production-release-gate-report` conclusion is `GO`.

Do not treat source hardening as a production-ready decision. As of 2026-08-08,
release remains blocked until Render memory evidence, GitHub Production Release
Gate verification, staging smoke, and restore rehearsal evidence are complete.
Local Task 2 secret scan is PASS, but that does not replace a clean release-gate
run for the exact candidate SHA.

## Environment

Production Render backend must use:

```text
SPRING_PROFILES_ACTIVE=prod
JPA_DDL_AUTO=validate
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=false
FLYWAY_BASELINE_VERSION=1
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_PATH=/
```

Required secret/environment variable names:

- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `OAUTH_SUCCESS_REDIRECT_URI`

Release-gate deployed environment evidence names:

- `RELEASE_ENV_SOURCE`
- `RELEASE_DEPLOYMENT_ID`
- `RELEASE_ENV_CAPTURED_AT`

These values must describe the real deployment or signed redacted environment
manifest for the exact release candidate. The validator fixture in CI is only a
self-test and must not be used as production readiness evidence.

Operational environment variable names:

- `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE`
- `LOGGING_LEVEL_ROOT`
- `LOGGING_LEVEL_SECURITY`
- `RATE_LIMIT_MODE`
- `AI_EXPLAIN_RATE_LIMIT_PER_MINUTE`
- `AI_EXPLAIN_RATE_LIMIT_PER_DAY`
- `AI_DECK_RATE_LIMIT_PER_MINUTE`
- `AI_DECK_RATE_LIMIT_PER_DAY`
- `AI_RATE_LIMIT_MINUTE_WINDOW`
- `SYNC_MAX_REQUEST_BODY_BYTES` (defaults to `1048576`; caps `POST /api/sync`
  before JSON deserialization)
- `ANALYTICS_DEFAULT_ZONE` (optional IANA zone; defaults/falls back to `UTC`)

Complete backend env inventory read by the current application config:

| Key | Category | Notes |
| --- | --- | --- |
| `DATABASE_URL` | database | JDBC URL for PostgreSQL or default H2 fallback. |
| `DATABASE_USERNAME` | database secret | Datasource username. |
| `DATABASE_PASSWORD` | database secret | Datasource password. |
| `JPA_DDL_AUTO` | database safety | Must be `validate` for production. |
| `FLYWAY_ENABLED` | database safety | Must be `true` for production after baseline/rehearsal. |
| `FLYWAY_BASELINE_ON_MIGRATE` | database safety | Must remain `false` for production app startup. |
| `FLYWAY_BASELINE_VERSION` | database safety | Baseline marker version for controlled maintenance only. |
| `FLYWAY_BASELINE_DESCRIPTION` | database safety | Optional baseline marker description. |
| `GOOGLE_CLIENT_ID` | OAuth secret/config | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | Google OAuth client secret. |
| `FRONTEND_URL` | browser/OAuth | Frontend base URL and default redirect base. |
| `CORS_ALLOWED_ORIGINS` | browser/OAuth | Exact comma-separated allowed browser origins. |
| `OAUTH_SUCCESS_REDIRECT_URI` | browser/OAuth | Optional explicit post-login redirect. |
| `SESSION_COOKIE_SAME_SITE` | session | Use `none` for cross-site production frontend/backend. |
| `SESSION_COOKIE_SECURE` | session | Use `true` in production. |
| `SESSION_COOKIE_PATH` | session | Usually `/`. |
| `APP_SECURITY_HSTS_ENABLED` | security headers | Enables HSTS on HTTPS responses. |
| `AI_MODEL` | AI | OpenAI model name. |
| `OPENAI_API_KEY` | AI secret | Optional; backend falls back when blank. |
| `RATE_LIMIT_MODE` | AI rate limit | Current supported mode is `in-memory`. |
| `AI_RATE_LIMIT_MINUTE_WINDOW` | AI rate limit | AI minute-window duration. |
| `AI_EXPLAIN_RATE_LIMIT_PER_MINUTE` | AI rate limit | Explain endpoint per-minute limit. |
| `AI_EXPLAIN_RATE_LIMIT_PER_DAY` | AI rate limit | Explain endpoint per-day limit. |
| `AI_DECK_RATE_LIMIT_PER_MINUTE` | AI rate limit | Deck endpoint per-minute limit. |
| `AI_DECK_RATE_LIMIT_PER_DAY` | AI rate limit | Deck endpoint per-day limit. |
| `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE` | observability | Default `health,info,metrics`; security still protects metrics from anonymous access. |
| `LOGGING_LEVEL_ROOT` | observability | Root logging level. |
| `LOGGING_LEVEL_SECURITY` | observability | Spring Security logging level. |
| `APP_VERSION` | actuator info | Non-secret version label. |
| `APP_ENV` | actuator info | Non-secret environment label. |
| `SYNC_MAX_REQUEST_BODY_BYTES` | sync safety | Pre-deserialization body cap for `POST /api/sync`. |
| `ANALYTICS_DEFAULT_ZONE` | analytics | Calendar zone for trend/overdue grouping; defaults and invalid values fall back to `UTC`. |

Never print or paste secret values into release reports.

## Observability

The backend uses Spring Boot Actuator and Micrometer for minimum production visibility:

- `GET /api/health` is the public lightweight application liveness endpoint.
- `GET /actuator/health` exposes safe Actuator health without details.
- `GET /actuator/info` exposes non-secret app metadata, AI enabled state, Flyway enabled state, and rate-limit mode.
- `GET /actuator/metrics` and `GET /actuator/metrics/{name}` expose Micrometer metrics only to authenticated sessions or an operator-managed monitoring channel. Anonymous requests return `401`.

Every request receives an `X-Request-ID` response header. If a trusted proxy or client sends a short safe value, the backend preserves it; otherwise it generates a UUID. The request ID is added to MDC and appears in logs as `requestId=...`.

Custom application metrics:

- `wordarena.http.requests`
- `wordarena.http.errors`
- `wordarena.sync.conflicts`
- `wordarena.quiz.failures`
- `wordarena.ai.failures`
- `wordarena.rate_limit.hits`
- `wordarena.review.failures`
- `wordarena.snapshot.failures`
- `wordarena.analytics.failures`

Recommended alert rules before public production:

| Severity | Signal | Threshold | Owner | Action | Evidence location |
| --- | --- | --- | --- | --- | --- |
| Critical | `/api/health` or `/actuator/health` fails | 2 consecutive failed checks or 5 minutes unavailable | Release owner | Check Render events/logs, recent deploy, database availability, and roll back if user traffic is impacted | Release issue or external alert incident |
| High | 5xx errors | Above normal baseline for 5 minutes | Release owner | Inspect request IDs, recent deploys, database errors, and provider status | Metrics dashboard screenshot/export plus incident note |
| High | app restart/OOM | Any unexpected restart, memory-limit event, or OOM | Release owner | Capture Render event, JVM memory trend if available, recent request volume, and heap budget notes | Render event plus metrics evidence |
| High | DB pool exhaustion | Active connections near pool max or acquisition timeouts for 5 minutes | Database owner | Check Supabase availability, long queries, connection leaks, and pool sizing | DB/provider alert or dashboard evidence |
| Medium | `wordarena.sync.conflicts` or sync failures | Spike above normal device-sync behavior for 10 minutes | Release owner | Check deploy diff, client sync logs by request ID, and rollback if caused by protocol regression | Metrics snapshot and linked request IDs |
| Medium | `POST /api/sync` 413 spike | Repeated spikes above normal import/sync behavior | Release owner | Check payload size pattern and client import behavior; do not raise caps without capacity evidence | Metrics snapshot and sample request IDs |
| Medium | `wordarena.ai.failures` or `wordarena.rate_limit.hits` spike | Repeated failures or unexpected rate-limit hits for 10 minutes | Release owner | Check provider status, API key presence, fallback behavior, and cost/abuse pattern | Metrics snapshot and provider status |
| Medium | release gate, backup, or staging smoke failure | Any release-candidate `NO-GO` | Release owner | Stop deployment and resolve the blocked/failed control without overriding evidence | Gate artifact for the exact commit |

Review cadence: before each release candidate and after any incident. This
repository does not configure PagerDuty, Slack, email, Grafana, Prometheus, or
Render alerts directly. Treat the alert rules as `DOCUMENTED_ONLY` until the
operator connects a real alert backend and stores delivered notification
evidence.

Deployment assumption for this hardening pass: repository documentation describes one Render backend web service and does not show multi-instance autoscaling, material AI cost abuse, or a shared Redis dependency. Therefore distributed rate limiting is intentionally not a production requirement yet.

## Backup

Before any production migration, the owner must create a database backup using the managed provider backup/export mechanism or `pg_dump` from a trusted environment. Record only the backup ID, timestamp, database host alias, and operator name in the release evidence.

Backup verification must include:

- backup completed successfully;
- backup timestamp is before migration;
- backup belongs to the target production database;
- backup can be listed or downloaded by the operator;
- no raw data or secret is attached to the release report.

## Restore Rehearsal

Restore rehearsal must be performed on a non-production database before the release gate can be `GO`.

Minimum restore rehearsal evidence:

- source backup ID or timestamp;
- target non-production database identifier;
- restore command/tool used;
- Flyway `info` or application startup against restored copy;
- smoke result for `/api/health`;
- operator and timestamp.

The gate records `BLOCKED` when this evidence is missing.

## Authenticated Staging Smoke

Before the release gate can be `GO`, staging or an equivalent disposable
environment must have authenticated smoke evidence. The direct staging script
checks only `/api/health`, `/api/csrf`, and the frontend root; it also requires
`docs/staging-auth-smoke-evidence.md` or the path in
`STAGING_AUTH_SMOKE_EVIDENCE_FILE`.

Minimum authenticated smoke evidence:

- exact commit SHA, timestamp, environment alias, and operator;
- staging frontend/backend URL or redacted environment alias;
- OAuth login or equivalent documented session-auth success;
- CSRF token bootstrap and unsafe request success;
- vocabulary CRUD using `audit-smoke-` test data;
- sync with the expected revision contract;
- delete/tombstone verification with no resurrection;
- logout or documented safe session cleanup;
- RTO/RPO notes or link to the restore rehearsal record.

The gate records `BLOCKED` when this evidence is missing, partial, placeholder,
or marked `NOT RUN`.

## App Rollback

Rollback app procedure:

1. Identify last known good commit SHA and Render deploy ID.
2. Use Render rollback or deploy that commit.
3. Keep `SPRING_PROFILES_ACTIVE=prod`, `JPA_DDL_AUTO=validate`, and `FLYWAY_ENABLED=true`.
4. Check `/api/health` and `/actuator/info`.
5. Run frontend login/session and vocabulary smoke.

## Database Rollback Or Forward-Fix

Database migrations are forward-only by default. If a migration has already run:

- prefer a reviewed forward-fix migration for additive schema issues;
- restore from backup only when data corruption or destructive schema change is confirmed;
- never edit an already-applied Flyway migration;
- never run Flyway clean in production.

## Owner

Release owner: project maintainer operating the Render/Supabase deployment.

Database owner: project maintainer operating the Supabase database.

Rollback owner: same release owner unless explicitly delegated in the release issue.

## Rollback Trigger

Trigger rollback or forward-fix when any of these occur:

- backend fails health checks after deployment;
- OAuth login/callback fails for production domain;
- session cookie/CORS/CSRF prevents authenticated API calls;
- Flyway migration fails or Hibernate validate fails;
- sync deletes resurrect data;
- material data corruption is detected;
- error rate or user-visible failure is above acceptable threshold.

## Post-Deployment Verification

After deployment:

1. Confirm Render service is live.
2. Confirm logs show `profiles=prod` and `flywayEnabled=true`.
3. Confirm Flyway reports schema up to date.
4. Confirm `/api/health` returns success.
5. Confirm frontend can call backend with credentials.
6. Confirm login flow redirects to production frontend.
7. Confirm authenticated vocabulary CRUD, sync, delete/tombstone, and logout
   using non-production test data before promoting the same pattern to
   production verification.
