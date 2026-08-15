# Frontend

The frontend is a static HTML/CSS/JavaScript app. `frontend/js/config.js` owns backend origin detection and the central API helper.

## Quality Gates

Run these checks after frontend JavaScript changes:

```powershell
npm run check:frontend
npm run lint
npm run test:frontend
npm run build:frontend
```

`npm run check:frontend` recursively runs `node --check` for every file under
`frontend/js`. `npm run lint` uses ESLint with browser globals and the current
`eslint-suppressions.json` baseline for legacy script-global debt. Do not add
new suppressions casually; prune the baseline when AUD-008 module extraction or
other focused cleanup removes existing violations.

Full JSDoc/checkJs typechecking is intentionally deferred while the frontend
remains script-global. The current lint baseline is the ratchet for name/global
drift until modules can be extracted without a big-bang rewrite.

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

## Mobile App Shell

At `620px` and below, the app shell keeps the six primary workspace routes visible and moves secondary tools into the `#sidebarToolsToggle` / `#sidebarToolsPanel` disclosure. Keep existing tool button ids stable because import/export/theme/preview handlers and smoke tests depend on them.

Sync status may use shorter visible text on small screens, but the full status message must remain available through `aria-label` and `title`. The vocabulary table is intentionally wider than mobile screens and must keep horizontal scrolling inside `.table-container`, not on the document.

## Inline-Free Markup

`frontend/index.html` must not reintroduce inline event handlers, inline `style=`
attributes, `javascript:` URLs, or inline script blocks. Use stable ids,
`data-ui-action`, or existing module init functions with `addEventListener`
instead. The smoke suite has a static guard for `index.html` and `login.html`.

## Local Import Safety

JSON import parses and validates the selected file before opening
`#importReviewDialog`. Preview is read-only and shows current/incoming counts,
invalid entries, merge duplicates, and estimated Merge/Replace outcomes.

- `Cancel` and Escape close the dialog without changing vocabulary, wrong-bank,
  sync metadata, or pending deletions.
- `Merge into current data` keeps existing local entries and all their fields;
  incoming duplicates are skipped using normalized English spelling.
- `Replace local data` is never the default action. It first downloads a local
  recovery backup and is blocked if backup creation fails.
- Imported backup sync metadata and pending deletions are ignored. The current
  account's sync state is preserved.
- The next vocabulary and wrong-bank state is built and validated in memory.
  A storage-capacity probe runs before commit; any write failure restores the
  previous storage values and leaves in-memory state unchanged.

Legacy array imports and versioned `{ vocab, wrongWords }` backup payloads stay
supported. CSV import remains merge-only and now rejects missing required
headers or unterminated quoted fields without mutating local vocabulary.

# Sync V2 Local Identity

Frontend words now carry a stable `wordUid`. `normalizeWord()` creates a UUID for legacy/local words and `main.js` persists normalized data on startup so offline-created identity survives rename, refresh, and later login.

Merge behavior:

- Prefer `wordUid` for all cloud/local merge keys.
- Use English only as a legacy adoption fallback when a local/generated UID has not yet been reconciled with cloud identity.
- Apply server `tombstones` before merging live `vocab` and `wrongWords`.
- Remove tombstoned words from local vocabulary, wrong-bank data, and the pending delete queue when either `wordUid` matches or legacy numeric `id` matches `legacyWordId`.

Offline delete behavior:

- New queue entries are `{ wordUid, legacyWordId, queuedAt, attempts, lastAttemptAt, lastStatus, lastError }`.
- Direct fast-path delete uses `DELETE /api/vocab/uid/{wordUid}` when possible.
- Full sync also sends pending `{ wordUid }` deletion intents in `deletions`, so failed direct deletes do not block normal sync.
- On `409 SYNC_REVISION_CONFLICT`, the frontend pulls a snapshot, applies tombstones, rebuilds the payload, and retries once.
