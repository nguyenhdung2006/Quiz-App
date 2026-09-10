# Troubleshooting

## Release Gate Says NO-GO

- `source-integrity=FAIL`: check `git status --short`. The release candidate must be clean and generated report folders must remain ignored.
- `production-env-validation=FAIL`: load real production env vars. Placeholders, localhost URLs, wildcard CORS, Flyway disabled, or `ddl-auto` other than `validate` fail the gate.
- `backup-rollback-readiness=BLOCKED`: add complete non-production restore rehearsal evidence at `docs/restore-rehearsal-evidence.md` or set `RELEASE_RESTORE_REHEARSAL_EVIDENCE_FILE` to an equivalent reviewed evidence file.
- `staging-smoke=BLOCKED`: set `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`.

## Sync Conflicts

409 with `SYNC_REVISION_CONFLICT` means the client sent a stale `expectedRevision`. Pull `/api/snapshot`, merge tombstones first, rebuild the push payload, and retry once.

If a conflict occurs immediately after a successful mutation in the same tab,
verify the response includes `X-Sync-Revision` and that CORS exposes it. The
frontend should store that value before its next sync; do not disable genuine
`409` handling.

400 with `SYNC_CLIENT_UPGRADE_REQUIRED` means the client did not send `syncContractVersion: 2`.

## Local Save Or Cloud Sync Fails

When the browser cannot write the authoritative local transaction, the app keeps
the current account's working vocabulary and wrong-bank edits in memory, leaves
the last committed snapshot unchanged, and reports the storage failure. Retry the
save before closing or reloading the tab; in-memory edits cannot survive a reload
while browser storage itself remains unavailable.

A backend/cloud failure does not clear the account-local committed data. Use the
visible Retry action after connectivity returns. If a reload still shows another
account's words, inspect `quizUserProfile` and the matching
`quizAccount:<normalized-email>:*` keys; do not merge or copy data between account
namespaces as a recovery shortcut.

`413 Payload Too Large` means the full cloud-sync request exceeded the configured
backend limit. The frontend keeps the account-local data unchanged, reports that
the payload is too large and that local data is still saved, and leaves Retry
available. A retry resends the current payload; do not delete local words as an
automatic recovery shortcut.

## Deleted Word Reappears Locally

Verify the client applied `tombstones` from snapshot before merging live `vocab`. Legacy records should also be removed when tombstone `legacyWordId` matches local numeric `id`.

## Cleared Wrong-Bank Entry Reappears

Clear Mastered must send the entry's stable UID in `wrongWordDeletions` with the
current `expectedRevision`. The server intentionally ignores deletion intents
for words below canonical mastery (`streak < 5`), and a stale revision rejects
the whole sync with `409`.

## CSRF 403

Unsafe requests must first call `GET /api/csrf`, then send `X-XSRF-TOKEN` with credentials included. Do not retry unsafe requests blindly after a 403.

## Production Startup Fails On Database

For `prod` or `production`, effective settings must keep Hibernate `ddl-auto=validate`, Flyway enabled, Flyway `baseline-on-migrate=false`, and Flyway clean disabled. Check `application-prod.yml`, environment overrides, and `ProductionDatabaseSafetyGuard` output.
