# Changelog

## 2026-07-30

- Enabled Spring Security CSRF protection for the OAuth2 session backend.
- Added public `GET /api/csrf` token bootstrap endpoint.
- Added JSON `403` error handling for security filter access denied failures.
- Changed logout flow to `POST /logout` with CSRF and `204 No Content` response.
- Added central frontend `window.quizApiFetch` helper with trusted-origin CSRF handling.
- Updated all frontend backend API calls to use the central helper.
- Added backend CSRF/security regression tests.
- Added frontend CSRF API helper smoke tests.
- Documented CSRF, logout, CORS, and verification commands.

