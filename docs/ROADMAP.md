# Roadmap

## Release Blockers

- Load real production/staging env vars and pass `npm run gate:validate-env`.
- Provide restore rehearsal evidence at `docs/restore-rehearsal-evidence.md` or via `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`.
- Run staging smoke with `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`.
- Re-run source integrity from a clean committed release candidate.

## Near Term

- Add generated OpenAPI documentation or a checked contract spec.
- Add deployed Google OAuth login/logout E2E coverage.
- Add explicit security header assertions for CSP/HSTS/referrer policy after deployment target is finalized.
- Continue incremental backend service split: CRUD, quiz result, snapshot query, and profile use cases.
- Add measured query improvements for duplicate lookup, due review queue, analytics, and history.

## Later

- Add pagination or delta sync for large accounts.
- Add quiz attempt anti-replay only if product requirements demand it.
- Define tombstone retention and cleanup policy after real data-age needs are known.
- Upgrade AI rate limiting to distributed storage only when the backend runs multiple instances, AI cost risk is material, or abuse evidence appears.
- Add external monitoring/APM when production traffic justifies it.
