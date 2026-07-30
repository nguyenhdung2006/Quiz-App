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
# Sync V2 Local Identity

Frontend words now carry a stable `wordUid`. `normalizeWord()` creates a UUID for legacy/local words and `main.js` persists normalized data on startup so offline-created identity survives rename, refresh, and later login.

Merge behavior:

- Prefer `wordUid` for all cloud/local merge keys.
- Use English only as a legacy adoption fallback when a local/generated UID has not yet been reconciled with cloud identity.
- Apply server `tombstones` before merging live `vocab` and `wrongWords`.
- Remove tombstoned `wordUid`s from local vocabulary, wrong-bank data, and the pending delete queue.

Offline delete behavior:

- New queue entries are `{ wordUid, legacyWordId, queuedAt, attempts, lastAttemptAt, lastStatus, lastError }`.
- Direct fast-path delete uses `DELETE /api/vocab/uid/{wordUid}` when possible.
- Full sync also sends pending `{ wordUid }` deletion intents in `deletions`, so failed direct deletes do not block normal sync.
- On `409 SYNC_REVISION_CONFLICT`, the frontend pulls a snapshot, applies tombstones, rebuilds the payload, and retries once.

