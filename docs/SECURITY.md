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

