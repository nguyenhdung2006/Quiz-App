# Project State

Date: 2026-07-30

The project keeps Google OAuth2 login with server-side Spring Security sessions. CSRF is enabled for unsafe requests using `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header.

Frontend backend calls are centralized through `window.quizApiFetch` in `frontend/js/config.js`. The helper keeps credentials for trusted backend requests, obtains CSRF tokens from `GET /api/csrf`, stores the token in memory only, and avoids adding CSRF to third-party requests.

Logout is now `POST /logout` with CSRF. Backend returns `204 No Content`; frontend redirects to `login.html?loggedOut=true`.

