# Security

## Authentication Model

WordArena uses Spring Security OAuth2 login with Google and a server-side HTTP session. The browser stores the authenticated session in `JSESSIONID`. The application does not use JWT, bearer tokens, localStorage auth tokens, or stateless authentication.

## CSRF Protection

CSRF is enabled for unsafe HTTP methods. The backend uses a cookie-backed CSRF token contract:

- CSRF cookie: `XSRF-TOKEN`
- CSRF header: `X-XSRF-TOKEN`
- Token bootstrap endpoint: `GET /api/csrf`
- Session cookie: `JSESSIONID`, kept separate from the CSRF token and not exposed to frontend JavaScript

Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) must include a valid `X-XSRF-TOKEN` header. Safe methods (`GET`, `HEAD`, `OPTIONS`) do not require the header and must remain side-effect free.

`GET /api/csrf` is public and returns:

```json
{
  "headerName": "X-XSRF-TOKEN",
  "parameterName": "_csrf",
  "token": "csrf-token-value"
}
```

The endpoint also sets the `XSRF-TOKEN` cookie. The frontend keeps the returned token in memory and does not store it in `localStorage` or `sessionStorage`.

## Logout

Logout is an unsafe operation and must be called as:

```http
POST /logout
X-XSRF-TOKEN: <token>
Cookie: JSESSIONID=<session>; XSRF-TOKEN=<token>
```

Successful logout returns `204 No Content` and deletes `JSESSIONID` and `XSRF-TOKEN`. The frontend then redirects to `login.html?loggedOut=true`.

## CSRF Error Contract

Missing or invalid CSRF tokens return JSON, not HTML redirects:

```json
{
  "message": "Forbidden.",
  "errors": ["Access denied."]
}
```

## CORS

CORS is configured once in Spring Security before authorization. It allows credentials and never uses wildcard origins with credentials. Allowed origins are read from `app.frontend.origin`. Allowed methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`. Allowed request headers are `Accept`, `Content-Type`, and `X-XSRF-TOKEN`.

Production cross-site deployment must keep:

- `SESSION_COOKIE_SAME_SITE=none`
- `SESSION_COOKIE_SECURE=true`
- `CORS_ALLOWED_ORIGINS` set to the exact frontend origins
- `FRONTEND_URL` set to the exact frontend URL
# Sync V2 Security Boundary

Sync V2 keeps OAuth2 session authentication and CSRF requirements unchanged. All unsafe sync and CRUD requests still require a valid session and `X-XSRF-TOKEN`.

Authorization remains per authenticated `AppUser`: `wordUid` is unique only within a user boundary, and tombstone lookups are scoped by `(user_id, word_uid)`. A user can reuse the same UUID value as another user without reading, deleting, or blocking that user's data.

The server ignores client-supplied `wrongWords` for vocabulary creation/update and ignores client-managed progress stats/mastery in sync payloads. This prevents stale or forged client payloads from creating vocabulary through the wrong-bank channel or overwriting server-managed learning progress.

## Production Release Gate Security Controls

The production release gate adds these fail-closed security checks:

- secret scan for committed `.env`, private keys, OAuth secrets, tokens, passwords, and API keys;
- production environment validation without printing secret values;
- CSRF regression tests for missing, invalid, and valid token paths;
- CORS validation that rejects wildcard production origins;
- session cookie validation for `Secure` and `SameSite`;
- business integrity regression tests proving client quiz summaries cannot directly award XP, levels, achievements, mastery, or stats;
- cross-user mutation tests for quiz and sync boundaries.

If staging variables are missing, staging security smoke is `BLOCKED` and the gate conclusion is `NO-GO`.
