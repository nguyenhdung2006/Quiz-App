# Pending Tasks

## Release Gate Blockers

- Re-run source integrity from a clean committed release candidate.
- Load real production environment variables and pass `npm run gate:validate-env`.
- Provide restore rehearsal evidence at `docs/restore-rehearsal-evidence.md` or set `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true` only after a real non-production restore rehearsal.
- Run staging smoke with `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`.
- Run a real browser Google OAuth2 login/logout E2E against deployed frontend/backend cookies.

## Product/Engineering Follow-Up

- Implement bounded physical cleanup for consumed attempts older than the approved seven-day target; do not add a scheduler framework without evidence.
- Include review-operation ledger retention in that same lifecycle batch; no physical age-based cleanup currently runs.
- Add generated OpenAPI or checked API contract documentation.
- Add explicit security header tests after hosting/header policy is finalized.
- Continue small backend service extraction beyond `SyncService`.
- Keep Finding 11 paused at the current incremental boundary unless a future evidence-backed seam materially reduces coupling without broad state/module, profile/account, or stale-recovery risk.
- Evaluate database aggregate projections for the remaining analytics collection scans with PostgreSQL parity evidence.
- Design pagination or delta sync for large accounts as a separate architecture-gated contract change.
- Define tombstone and quiz-history retention/cleanup policy; do not garbage collect either dataset without product/data-lifecycle approval.
- Upgrade to distributed rate limiting only after multi-instance deployment, material AI cost risk, or abuse evidence.
