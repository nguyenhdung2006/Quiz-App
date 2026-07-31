# Troubleshooting

## Release Gate Says NO-GO

- `source-integrity=FAIL`: check `git status --short`. The release candidate must be clean and generated report folders must remain ignored.
- `production-env-validation=FAIL`: load real production env vars. Placeholders, localhost URLs, wildcard CORS, Flyway disabled, or `ddl-auto` other than `validate` fail the gate.
- `backup-rollback-readiness=BLOCKED`: add restore rehearsal evidence or set `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true` only after a real non-production restore rehearsal.
- `staging-smoke=BLOCKED`: set `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`.

## Sync Conflicts

409 with `SYNC_REVISION_CONFLICT` means the client sent a stale `expectedRevision`. Pull `/api/snapshot`, merge tombstones first, rebuild the push payload, and retry once.

400 with `SYNC_CLIENT_UPGRADE_REQUIRED` means the client did not send `syncContractVersion: 2`.

## Deleted Word Reappears Locally

Verify the client applied `tombstones` from snapshot before merging live `vocab`. Legacy records should also be removed when tombstone `legacyWordId` matches local numeric `id`.

## CSRF 403

Unsafe requests must first call `GET /api/csrf`, then send `X-XSRF-TOKEN` with credentials included. Do not retry unsafe requests blindly after a 403.

## Production Startup Fails On Database

For `prod` or `production`, effective settings must keep Hibernate `ddl-auto=validate`, Flyway enabled, Flyway `baseline-on-migrate=false`, and Flyway clean disabled. Check `application-prod.yml`, environment overrides, and `ProductionDatabaseSafetyGuard` output.
