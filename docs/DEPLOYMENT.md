# Deployment And Rollback Runbook

This document complements `docs/deploy.md` with the release-gate-specific production handoff checklist.

## Required Pre-Deployment Gate

Run the GitHub Actions workflow **Production Release Gate** for the exact commit SHA intended for production. Do not deploy production unless the `production-release-gate-report` conclusion is `GO`.

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

Never print or paste secret values into release reports.

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
