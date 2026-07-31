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

## Logging Safety

Production logs must not include secrets, OAuth credentials, cookies, CSRF tokens, passwords, API keys, raw request bodies, or user-authored vocabulary payloads. The backend log format includes `requestId` for correlation and keeps application events as bounded key-value messages.

The request ID comes from `X-Request-ID` only when it is short and contains safe characters. Unsafe, blank, or overlong values are replaced with a server-generated UUID before being written to the response header or MDC.

Root logging should stay at `INFO` in production. `DEBUG`, `TRACE`, and `ALL` are rejected by the production environment gate because they can expose framework internals and excessive request context.

## Rate Limit Policy

AI endpoints are the current cost-sensitive surface and use an in-memory per-user limiter:

- `POST /api/ai/explain-wrong-answer`
- `POST /api/ai/generate-deck`

The limit key is scoped to the authenticated user ID when available. If the user has no database ID, the service falls back to normalized email; otherwise it fails because authenticated identity is required.

Configuration is environment-driven:

- `RATE_LIMIT_MODE=in-memory`
- `AI_EXPLAIN_RATE_LIMIT_PER_MINUTE`
- `AI_EXPLAIN_RATE_LIMIT_PER_DAY`
- `AI_DECK_RATE_LIMIT_PER_MINUTE`
- `AI_DECK_RATE_LIMIT_PER_DAY`
- `AI_RATE_LIMIT_MINUTE_WINDOW`

Limit hits return `429` with the existing AI error contract and a `retryAfterSeconds` value. They are logged without user content and counted by `wordarena.rate_limit.hits`.

Current limitation: the limiter is process-local. It is appropriate for the current single-backend-instance Render deployment, but it is not a global quota if the backend scales horizontally. Add Redis or another distributed store only after multi-instance deployment, material AI cost risk, or abuse evidence exists.
