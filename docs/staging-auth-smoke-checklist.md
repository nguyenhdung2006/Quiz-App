# Staging Authenticated Smoke Checklist

This is a preparation checklist, not completed release evidence.

Do not create `docs/staging-auth-smoke-evidence.md` until a real
non-production authenticated smoke has been performed. Do not include raw
cookies, CSRF token values, OAuth client secrets, database URLs, access tokens,
or user data in the final evidence file.

## Scope

- Use staging or a disposable environment only.
- Use a test identity and test records with an `audit-smoke-` prefix.
- Do not use production user data.
- Record timestamps, commit SHA, environment aliases, and PASS/BLOCKED results.
- Redact URLs if needed, but keep enough non-secret detail for a reviewer to
  identify the environment.

## Required Evidence Fields

Use these fields when creating `docs/staging-auth-smoke-evidence.md` after a
real staging smoke:

| Field | Required value |
| --- | --- |
| Smoke date/time | UTC timestamp for the smoke |
| Commit | Exact commit SHA under test |
| Environment | Staging/disposable environment alias |
| Operator | Person who performed the smoke |
| Staging frontend URL | HTTPS frontend URL or redacted environment alias |
| Staging backend URL | HTTPS backend URL or redacted environment alias |
| Health smoke | PASS only after `/api/health` returns 2xx |
| CSRF smoke | PASS only after `/api/csrf` returns JSON and a CSRF cookie |
| OAuth/auth smoke | PASS only after OAuth/login or equivalent documented session auth reaches authenticated `/api/me` |
| Vocabulary CRUD smoke | PASS only after `audit-smoke-` vocabulary create/read/update succeeds |
| Sync smoke | PASS only after authenticated sync succeeds with the expected revision contract |
| Delete/tombstone smoke | PASS only after delete creates/verifies tombstone behavior and no resurrection |
| Logout smoke | PASS only after logout/session cleanup is verified, or a documented safe cleanup equivalent succeeds |
| RTO/RPO notes | Restore duration and backup coverage notes, or the linked restore rehearsal record |
| Result | PASS only after all required smoke steps are real |

## Safe Gate Command

After real evidence exists:

```powershell
$env:STAGING_BACKEND_URL='https://staging-backend.example'
$env:STAGING_FRONTEND_URL='https://staging-frontend.example'
$env:STAGING_TEST_USER_HINT='audit-smoke-test-user'
$env:STAGING_AUTH_SMOKE_EVIDENCE_FILE='docs/staging-auth-smoke-evidence.md'
npm run gate:staging-smoke
```

The gate remains `BLOCKED` if the evidence file is missing, malformed, partial,
or records `NOT RUN`/`PARTIAL`/`FAIL` for any required authenticated smoke step.
