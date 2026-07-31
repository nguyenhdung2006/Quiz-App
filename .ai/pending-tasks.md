# Pending Tasks

## Release Gate Blockers

- Re-run source integrity from a clean committed release candidate.
- Load real production environment variables and pass `npm run gate:validate-env`.
- Provide restore rehearsal evidence at `docs/restore-rehearsal-evidence.md` or set `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true` only after a real non-production restore rehearsal.
- Run staging smoke with `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`.
- Run a real browser Google OAuth2 login/logout E2E against deployed frontend/backend cookies.

## Product/Engineering Follow-Up

- Add generated OpenAPI or checked API contract documentation.
- Add explicit security header tests after hosting/header policy is finalized.
- Continue small backend service extraction beyond `SyncService`.
- Measure and optimize duplicate lookup, due review queue, analytics, recent history, and snapshot queries.
- Add pagination or delta sync for large accounts.
- Define tombstone retention/cleanup policy later; do not garbage collect tombstones without retention evidence.
- Upgrade to distributed rate limiting only after multi-instance deployment, material AI cost risk, or abuse evidence.
