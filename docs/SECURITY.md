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

The request header `X-Request-ID` is also allowed and exposed for correlation.

Production cross-site deployment must keep:

- `SESSION_COOKIE_SAME_SITE=none`
- `SESSION_COOKIE_SECURE=true`
- `APP_SECURITY_HSTS_ENABLED=true`
- `CORS_ALLOWED_ORIGINS` set to the exact frontend origins
- `FRONTEND_URL` set to the exact frontend URL

## Response Security Headers

Spring Security sets explicit response headers on backend responses:

- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` only when `app.security.hsts.enabled=true` and the request is HTTPS

The current CSP is intentionally compatible with the existing static frontend:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
frame-src 'none';
form-action 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
media-src 'self';
connect-src 'self' http://localhost:8080 http://127.0.0.1:8080 https://quiz-app-xd9m.onrender.com
```

The backend also sends `Content-Security-Policy-Report-Only` with stricter
`script-src 'self'` and `style-src 'self'` directives so future inline style
work can be observed before enforcement.

Current limitation: `frontend/index.html` no longer uses inline event handlers
or `javascript:` URLs, so `script-src 'unsafe-inline'` is no longer required in
the enforced policy. `style-src 'unsafe-inline'` remains in the enforced policy
because the current static frontend still uses JavaScript-driven inline style
updates for progress bars, timers, effects, and small transitions. The policy
does not allow `unsafe-eval`.

## Actuator And Metrics Access

Public anonymous actuator access is limited to:

- `GET /actuator/health`, with `management.endpoint.health.show-details=never`;
- `GET /actuator/info`, with non-secret application metadata.

`GET /actuator/metrics` and `GET /actuator/metrics/{name}` are intentionally
not public anonymous endpoints. They remain exposed by Actuator for local
operator checks and future monitoring integration, but Spring Security requires
an authenticated session before returning metric names, labels, or values.
Anonymous metrics requests return `401` instead of redirecting through the
browser OAuth flow.

Do not expose `env`, `beans`, `mappings`, `heapdump`, `configprops`,
`threaddump`, or Prometheus scraping endpoints publicly. If production needs
machine scraping later, add an operator-approved token, network allowlist, or
private monitoring path first, keep secrets outside the repository, and add
tests for the new policy.

## Profile And Avatar Safety

Profile updates are scoped to the authenticated `AppUser`; the client cannot choose a user id for `/api/profile`.

The backend sanitizes profile text and validates avatar values before storing or returning profile data. Avatar values are limited to:

- same-origin relative image paths such as `images/icon.png`;
- `https://` URLs with a valid host and no embedded user info;
- base64 data images for `png`, `jpg/jpeg`, `gif`, or `webp`.

Unsafe schemes and data types such as `javascript:`, protocol-relative URLs, `data:text/html`, and SVG data images are rejected on profile update. OAuth provider pictures are also sanitized before first save/output.

The frontend applies the same avatar whitelist before writing profile cache or assigning `img.src`, so unsafe stale localStorage values fall back to `images/icon.png`. Profile text is rendered with `textContent`; the profile Playwright smoke test verifies that HTML-like names remain text rather than becoming DOM nodes.

# Sync V2 Security Boundary

Sync V2 keeps OAuth2 session authentication and CSRF requirements unchanged. All unsafe sync and CRUD requests still require a valid session and `X-XSRF-TOKEN`.

Authorization remains per authenticated `AppUser`: `wordUid` is unique only within a user boundary, and tombstone lookups are scoped by `(user_id, word_uid)`. A user can reuse the same UUID value as another user without reading, deleting, or blocking that user's data.

The server ignores client-supplied `wrongWords` for vocabulary creation/update and ignores client-managed progress stats/mastery in sync payloads. This prevents stale or forged client payloads from creating vocabulary through the wrong-bank channel or overwriting server-managed learning progress.

`POST /api/sync` is capped before JSON deserialization by
`app.sync.max-request-body-bytes` / `SYNC_MAX_REQUEST_BODY_BYTES` (default
`1048576`). Oversized bodies return `413 Payload Too Large` with an `ApiError`
envelope instead of reaching the controller.

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

## Local Data Import Safety

JSON import does not apply file content during parsing or preview. Replace is an
explicit destructive action and requires a successful downloadable backup
first. Merge keeps local fields on duplicate English keys. Imported sync
metadata and pending deletion data are not trusted or applied.

Import persistence uses a capacity probe and restores prior vocabulary and
wrong-bank storage values if a write fails, including quota failures. The UI
surfaces the failure without logging raw vocabulary content. Browser site-data
clearing and the inherent capacity limits of `localStorage` remain platform
risks; this remediation does not migrate data to IndexedDB.

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
