# Restore Rehearsal Checklist

This is a preparation checklist, not completed restore evidence.

Do not rename or copy this file to `docs/restore-rehearsal-evidence.md` until a
real non-production restore rehearsal has been performed and verified. Do not
include raw data, database dumps, passwords, access tokens, or connection strings
in the final evidence file.

## Scope

- Use a non-production database only.
- Use a sanitized backup or provider-managed backup metadata only.
- Do not connect this rehearsal to production application traffic.
- Do not use production user credentials.
- Record identifiers and timestamps, not raw data.

## Required Evidence Fields

Use these fields when creating `docs/restore-rehearsal-evidence.md` after a real
rehearsal:

| Field | Required value |
| --- | --- |
| Rehearsal date/time | UTC timestamp for the rehearsal |
| Operator | Person who performed the rehearsal |
| Source backup reference | Backup ID or timestamp only |
| Source database alias | Non-secret database/provider alias |
| Target database | Non-production database identifier |
| Restore command/tool | Tool name or command shape with secrets omitted |
| Backup verification | Confirmation that the backup exists and predates the change |
| Restore verification | Confirmation that restore completed on non-production |
| Flyway/app verification | Flyway `info` or application startup against restored copy |
| Health smoke | `/api/health` result against the restored environment |
| Rollback app path | Last-known-good app rollback or redeploy procedure reference |
| DB rollback/forward-fix policy | Chosen policy and trigger conditions |
| Result | PASS only after all verification steps are real |

## Safe Command Template

Replace placeholders locally or in CI after a real rehearsal. Do not commit
secrets or raw output.

```powershell
# After real non-production restore rehearsal evidence exists:
npm run gate:backup-rollback

# Alternative only when the release record links to equivalent external evidence:
$env:RELEASE_RESTORE_REHEARSAL_EVIDENCE="true"
npm run gate:backup-rollback
```

## Conditions To Move From BLOCKED To PASS

- `docs/restore-rehearsal-evidence.md` exists and contains real non-production
  restore rehearsal evidence, or `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true` is
  set only when equivalent external evidence is linked from the release record.
- Required runbook docs exist:
  `docs/DEPLOYMENT.md`, `docs/PRODUCTION_RELEASE_GATE.md`,
  `docs/flyway-baseline-rehearsal.md`, and `docs/deploy.md`.
- Required concepts are present in the runbooks: backup, restore rehearsal,
  rollback app, forward-fix, owner, and rollback trigger.
- Evidence does not contain raw production data, passwords, tokens, private
  connection strings, or credentials.
- `npm run gate:backup-rollback` reports `[PASS] backup-rollback-readiness`.
