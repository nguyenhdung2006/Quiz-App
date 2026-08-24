# Frontend

The frontend is a static HTML/CSS/JavaScript app. `frontend/js/config.js` owns backend origin detection and the central API helper.

## Public Entry Routing

Repository routing assumes the current Vercel project keeps `frontend/` as its
Root Directory. `frontend/vercel.json` defines a temporary redirect from `/` to
`/login.html`. Both public URLs therefore show the login/landing page and Google
login entry after that commit is deployed.

`frontend/vercel.json` also applies the static frontend's browser security
headers. Keep the CSP external-script-only: do not add `unsafe-eval` or script
`unsafe-inline`. Style `unsafe-inline` remains temporarily required by the
ratcheted dynamic-style inventory.

`/index.html` remains the explicit authenticated app/dashboard entry. The
backend OAuth success default already targets `${FRONTEND_URL}/index.html`, so
the root redirect does not intercept the callback flow. Do not change the root
back to the app shell or point `OAUTH_SUCCESS_REDIRECT_URI` at `/`; an explicit
override should continue to end in `/index.html`.

## Quality Gates

Run these checks after frontend JavaScript changes:

```powershell
npm run check:frontend
npm run lint
npm run test:assets
npm run test:frontend-inline-styles
npm run test:frontend-import-helpers
npm run test:frontend-session-ui
npm run test:frontend-sync-status
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

## Frontend Dependency Map

`docs/frontend-dependency-map.md` is the source of truth for the current
script-global load order, stylesheet order, known public facades, and AUD-008
candidate extraction batches. Update it when a frontend boundary moves or a
script/CSS file is added to the runtime graph.

AUD-008 Batch 1 extracts the JSON import preview/merge calculations into
`frontend/js/import-helpers.js` as `window.WordArenaImport`. `frontend/js/app.js`
keeps the old wrapper function names and injects existing normalizers so import
behavior, storage shape, sync metadata handling, and tests remain compatible.
`npm run test:frontend-import-helpers` characterizes the helper behavior outside
the browser.

AUD-008 Batch 2 extracts sync status copy, DOM creation, tone rendering,
accessible full-text labels, and Retry button visibility into
`frontend/js/sync-status.js` as `window.WordArenaSyncStatus`. The original
`ensureSyncStatus` and `setSyncStatus` names remain thin compatibility wrappers
in `frontend/js/app.js`. Run
`npm run test:frontend-sync-status` to characterize that boundary without a
browser; the Playwright suite continues to cover the user-visible mobile,
offline, retry, stale recovery, and healthy sync states.

AUD-008 Batch 3 extracts the profile/session display model and DOM rendering
into `frontend/js/session-ui.js` as `window.WordArenaSessionUi`. It owns display
name and short-name derivation, signed-in/local identity copy, the accessible
profile-trigger label, and sanitized avatar assignment. `frontend/js/app.js`
still owns profile sanitization, account persistence, auth orchestration, and
leaderboard refresh. Run `npm run test:frontend-session-ui` for the helper
characterization suite; browser profile save and mobile trigger tests remain in
the Playwright suite.

## Stylesheet Source Of Truth

Runtime stylesheets are owned by HTML links. `frontend/index.html` loads:

- `frontend/css/base.css`
- `frontend/css/layout.css`
- `frontend/css/components.css`
- `frontend/css/typography.css`
- `frontend/css/quiz.css`
- `frontend/css/effects.css`
- `frontend/css/modern.css`
- `frontend/css/modern-theme-light.css`
- `frontend/css/modern-responsive.css`

`frontend/login.html` loads:

- `frontend/css/login.css`

`npm run test:assets` verifies that every `frontend/css/*.css` file is linked
from runtime HTML or imported by another CSS file. It also fails on missing CSS
references. Add a documented allowlist entry in
`scripts/frontend-css-assets-check.mjs` only for an intentional non-runtime CSS
asset.

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

Successful cloud mutations expose `X-Sync-Revision`. `app.js` adopts that
server-issued value immediately, including empty-body direct deletes, so the
next sync uses the real baseline while genuine stale-device conflicts still
follow the existing snapshot-and-retry path.

## Modal Keyboard Focus

The Profile Editor and How It Works dialogs use the shared focus manager in
`frontend/js/app.js`: focus moves into the dialog on open, Tab and Shift+Tab
stay inside, Escape closes, and focus returns to the logical opener. New app
dialogs should reuse that boundary rather than adding one-off key handlers.

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

JavaScript inline style writes are separately ratcheted by
`npm run test:frontend-inline-styles`. AUD-011 Batch 2 moves quiz timer/button
visibility to `hidden`, progress reset transition state to
`.progress--resetting`, and result colors to CSS selected by `data-grade`.
AUD-011 Batch 3 moves app/studio toast dismissal state to `.toast.is-hiding`.
The remaining 27 allowlisted writes require arbitrary percentages/coordinates
or belong to later focused migration batches; do not broaden the allowlist or
use inline CSS custom properties to bypass it.

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

Wrong-bank mastered clearing uses a separate account-local intent queue. The
client removes only the selected mastered entries locally and sends their
stable UIDs as `wrongWordDeletions`; successful snapshots reconcile the queue.
The backend remains authoritative about whether each entry is eligible.

Mark Known and Mark Hard also use dedicated server actions while online. The
client sends only `wordId`/intent and applies the returned authoritative word.
Offline local updates remain a fallback, but canonical mastered state is always
`streak >= 5`; a single correct review does not clear a wrong-bank entry.
