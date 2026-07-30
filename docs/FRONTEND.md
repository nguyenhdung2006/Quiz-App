# Frontend

The frontend is a static HTML/CSS/JavaScript app. `frontend/js/config.js` owns backend origin detection and the central API helper.

## API Helper

Use `window.quizApiFetch(url, options)` for all backend API calls.

Behavior:

- Adds `credentials: "include"` only for the configured backend origin.
- Adds `X-XSRF-TOKEN` only for trusted backend unsafe methods: `POST`, `PUT`, `PATCH`, `DELETE`.
- Does not add CSRF headers to third-party requests.
- Preserves caller headers such as `Content-Type` and custom headers.
- Does not set `Content-Type` automatically for `FormData`.
- Does not retry unsafe requests after `403`; it clears the in-memory CSRF token so the next user action can fetch a fresh token.

## CSRF Lifecycle

`window.quizCsrf.refresh()` calls `GET /api/csrf`, keeps the token in memory, and relies on backend cookies for the server-side CSRF check. `window.quizCsrf.clear()` clears the in-memory token after logout.

After `/api/me` confirms an authenticated session, `frontend/js/app.js` refreshes CSRF before starting cloud sync. This prevents the first post-login unsafe request from failing due to a missing token.

## Logout Flow

The profile logout button calls:

```js
await window.quizApiFetch(`${apiOrigin}/logout`, { method: "POST" });
```

After the request completes or fails locally, the frontend clears local profile state, clears in-memory CSRF state, and redirects to `login.html?loggedOut=true`.

