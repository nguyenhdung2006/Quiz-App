# Frontend Dependency Map

Last updated: 2026-08-28 +07

This document is the AUD-008 incremental extraction inventory for the current static
script-global frontend. It records the load order, known globals, and safe
extraction boundaries without changing UX, API contracts, storage formats, or
sync semantics.

## Runtime Load Order

`frontend/index.html` loads stylesheets in this order:

| Order | Stylesheet | Role |
| --- | --- | --- |
| 1 | `css/base.css` | Shared reset, tokens, base document styles. |
| 2 | `css/layout.css` | App shell and broad layout primitives. |
| 3 | `css/components.css` | Shared component-level rules. |
| 4 | `css/typography.css` | Type scale and text treatments. |
| 5 | `css/quiz.css` | Quiz-specific UI. |
| 6 | `css/effects.css` | Animation and visual effects. |
| 7 | `css/modern.css` | Main active app theme and many feature overrides. |
| 8 | `css/modern-theme-light.css` | Light theme overrides. |
| 9 | `css/modern-responsive.css` | Responsive overrides. |

`frontend/login.html` loads `css/login.css` after `js/theme.js`.

`frontend/index.html` loads scripts in this order:

| Order | Script | Confirmed responsibilities and globals |
| --- | --- | --- |
| 1 | `js/config.js` | Backend origin detection, `window.quizApiFetch`, CSRF helper. |
| 2 | `js/quiz-attempt-client.js` | `window.WordArenaQuizAttemptClient` issuance, exact submit/retry payload, and in-memory active-attempt state. |
| 3 | `js/storage.js` | Local persistence facade used by vocabulary and app flows. |
| 4 | `js/vocab.js` | Vocabulary state, normalization, CRUD helpers, local save/load facade. |
| 5 | `js/ui.js` | Shared render/status/toast-style UI helpers. |
| 6 | `js/effects.js` | Effects helpers and UI decoration hooks. |
| 7 | `js/timer.js` | Quiz timer helpers. |
| 8 | `js/quiz.js` | Quiz state and answer/review flow. |
| 9 | `js/ai-explain.js` | Optional wrong-answer explanation helper. |
| 10 | `js/challenge.js` | Challenge helpers. |
| 11 | `js/main.js` | Startup normalization and initial UI wiring. |
| 12 | `js/import-helpers.js` | `window.WordArenaImport` pure import preview/merge helper namespace. |
| 13 | `js/sync-status.js` | `window.WordArenaSyncStatus` copy/render namespace for cloud sync status. |
| 14 | `js/session-ui.js` | `window.WordArenaSessionUi` profile display model and DOM rendering namespace. |
| 15 | `js/ui-actions.js` | `window.WordArenaUiActions` command mapping for delegated `data-ui-action` controls. |
| 16 | `js/app.js` | Auth, profile persistence, cloud sync, stale recovery, import/export orchestration, app shell actions. |
| 17 | `js/curated-decks.js` | Curated deck UI/data helpers. |
| 18 | `js/ai-deck-client.js` | `window.WordArenaAiDeckClient` endpoint request/error facade. |
| 19 | `js/learning-studio-storage.js` | `window.WordArenaLearningStudioStorage` account-scoped history/flag access facade. |
| 20 | `js/learning-studio.js` | Learning Studio tabs, modal, deck generation/import UI. |
| 21 | `js/analytics-dashboard.js` | Analytics dashboard rendering. |
| 22 | `js/review-today.js` | Spaced repetition review UI. |

## Hotspots

| Area | Evidence | Boundary |
| --- | --- | --- |
| `frontend/js/app.js` | Large script-global coordinator for auth, cloud sync, import/export, account UI, stale recovery, and app shell actions. | Extract only side-effect-light helpers behind compatibility wrappers until a fuller module plan exists. |
| `frontend/js/learning-studio.js` | Large feature script with modal, tabs, deck generation, and import flows. | Keep accessibility tests in place before any further extraction. |
| `frontend/css/modern.css` | Main active theme and feature override file. | Defer CSS layer/source-map work; do not prune selectors without visual regression coverage. |
| Script globals | `vocab`, `wrongWords`, `showAppPage`, notification helpers, render helpers, quiz helpers, and sync helpers are shared by load order. | Public facades must remain stable while modules are extracted incrementally. |

## Confirmed Dependencies

| Consumer | Depends on | Notes |
| --- | --- | --- |
| `app.js` | `config.js` API/CSRF helpers | Backend calls use `window.quizApiFetch`. |
| `quiz-attempt-client.js` | `config.js` API/CSRF helpers and runtime `window.quizCloud.isReady()` | Owns only the attempt endpoint boundary; it stores no attempt data in localStorage. |
| `quiz.js`/`app.js` | `quiz-attempt-client.js` | Quiz start binds issued context; completion applies authoritative outcome/snapshot and monotonic revision handling. |
| `app.js` | `vocab.js` normalization/state helpers | Import, sync, and stale recovery rely on normalized word shape and local save/load behavior. |
| `app.js` | `sync-status.js` status facade | Compatibility wrappers delegate sync copy, rendering, ARIA text, and Retry visibility to `window.WordArenaSyncStatus`. |
| `app.js` | `session-ui.js` profile display facade | `applyProfile` keeps sanitize/cache orchestration and delegates display modeling and DOM writes to `window.WordArenaSessionUi`. |
| `app.js` | `ui-actions.js` command facade | The delegated document click listener forwards action names/source controls without directly naming 16 cross-script action functions. |
| `app.js` | `ui.js`/existing notification facade | Import and sync flows surface status through existing UI helpers. |
| `ui-actions.js` | classic-script action globals from vocabulary, quiz, UI, main, and challenge scripts | Centralizes the existing optional calls; providers still must exist by user interaction time. |
| `ai-deck-client.js` | `config.js` API/CSRF helpers | Captures the configured origin/transport at script load, matching the previous Learning Studio semantics. |
| `learning-studio-storage.js` | `storage.js` account key resolver and browser `localStorage` | Resolves the current account at each operation and preserves existing key/schema/fallback semantics. |
| `quiz.js` and review scripts | vocabulary globals and render helpers | Existing Playwright tests characterize main study flows. |
| `learning-studio.js` | `ai-deck-client.js`, `learning-studio-storage.js`, app/import facades, and DOM ids | AI transport and account-scoped storage access use focused browser-global facades; modal/import/UI behavior keeps existing dependencies. |
| responsive CSS | preceding base/component/modern rules | Later files intentionally override earlier rules. |

## Public Facades To Preserve

Keep these stable until every consumer and regression test is moved:

- vocabulary state and helper globals from `vocab.js`;
- page/navigation helpers such as `showAppPage`;
- notification/status helpers such as `toast` or `showNotification` where present;
- render/update helpers such as `renderTable`, `renderMistakeTable`, and `updateStats`;
- cloud sync facade fields under `window.quizCloud`;
- online quiz attempt calls through `window.WordArenaQuizAttemptClient`;
- import wrapper functions in `app.js`, now delegated to `window.WordArenaImport`;
- sync status wrapper functions in `app.js`, now delegated to `window.WordArenaSyncStatus`;
- profile application orchestration in `app.js`, with display rendering delegated to `window.WordArenaSessionUi`;
- delegated `data-ui-action` command resolution through `window.WordArenaUiActions`;
- AI Deck endpoint calls through `window.WordArenaAiDeckClient`;
- Learning Studio history and achievement-flag storage through `window.WordArenaLearningStudioStorage`;
- current DOM ids used by Playwright, import/export buttons, app navigation, and Learning Studio modal controls.

## Batch 1 Extraction

`frontend/js/import-helpers.js` introduces `window.WordArenaImport` with pure
helper functions for:

- import payload normalization and invalid entry counts;
- duplicate-aware merge by normalized English text;
- import review summary counts;
- Merge/Replace candidate state construction.

`frontend/js/app.js` keeps the original function names as compatibility wrappers
and injects the existing `cleanWord`, `normalizeEnglishKey`, `normalizeWord`, and
`stampWordUpdatedAt` helpers. This avoids changing storage format, local-first
behavior, import UI, or sync metadata handling.

## Batch 2 Extraction

`frontend/js/sync-status.js` introduces `window.WordArenaSyncStatus` with one
focused responsibility:

- compact known session/sync messages for the visible status;
- preserve the full message in `title` and `aria-label`;
- create the status element in the existing topbar/utility host;
- apply the existing tone class and Retry button visibility rules.

`frontend/js/app.js` keeps `ensureSyncStatus` and `setSyncStatus` as thin
compatibility wrappers. The module loads immediately
before `app.js`; no CSS, markup, API, storage, session, or sync semantics changed.
`scripts/frontend-sync-status.test.mjs` characterizes the helper namespace, and
the existing Playwright suite retains browser-level behavior coverage.

## Batch 3 Extraction

`frontend/js/session-ui.js` introduces `window.WordArenaSessionUi` with a small
profile display responsibility:

- normalize the display name and derive the existing short account name;
- build signed-in or local-guest identity copy;
- build the accessible profile-trigger label;
- render profile summary text and avatar targets through `textContent`,
  `setAttribute`, and an injected avatar sanitizer.

`frontend/js/app.js` retains `applyProfile` as the compatibility orchestration
point. It still sanitizes incoming profile data, switches/caches account-local
storage, delegates the display render, and refreshes the leaderboard. Auth fetch,
OAuth, API contracts, storage formats, markup, and CSS are unchanged.
`scripts/frontend-session-ui.test.mjs` characterizes the pure model and partial
DOM rendering behavior; existing Playwright tests cover profile save safety and
the mobile accessible account trigger.

## Finding 11 Batch 11A Extraction

`frontend/js/ai-deck-client.js` owns one endpoint boundary:

- `POST /api/ai/generate-deck` URL, JSON body, and content type;
- delegation to the existing CSRF/session-aware `window.quizApiFetch` transport;
- success JSON parsing and the existing 400/429/5xx/network/malformed-response
  error semantics.

`frontend/js/learning-studio.js` retains a thin `requestAiDeck` wrapper and all
UI state, cooldown, generated-word validation, editing, and import behavior.
The extraction removes its direct consumption of `quizApiOrigin` and
`quizApiFetch` in favor of one explicit endpoint facade. It does not remove a
runtime ordering edge: the client is loaded immediately before Learning Studio.
`scripts/frontend-ai-deck-client.test.mjs` covers the endpoint contract, while
Playwright covers CSRF, successful rendering, rate limiting, retry, and malformed
responses.

## Finding 12 Batch 12B Attempt Boundary

`frontend/js/quiz-attempt-client.js` owns the two rewarded online-quiz routes:

- issue one server attempt before rendering an online round;
- validate the returned ordinal, word ID, direction, and prompt against the
  prepared immutable browser question snapshot;
- retain the active attempt ID and serialized submission only in memory;
- retry a lost/transient submit with the same URL and byte-identical body;
- expose pending retry/reset state without adding a localStorage key or schema.

The classic script loads immediately after `config.js`. It resolves
`window.quizCloud.isReady()` only when a user starts a quiz, after `app.js` has
initialized the runtime facade. `quiz.js` keeps local presentation and offline
learning behavior; `app.js` applies authoritative outcome/snapshot data and the
existing monotonic revision rule. This is a narrow endpoint/state seam, not a
generic network framework or an ES-module conversion.
`scripts/frontend-quiz-attempt-client.test.mjs` characterizes request binding,
lost-response exact retry, invalid/unsynced local-only fallback, retained
pending state, and manual retry recovery.
Request-local attempt references and reset generations discard late results;
`app.js` additionally checks the original account/result context before applying
an outcome. Retry survives transient failures only within the active in-memory
lifecycle, not Home/reset, logout, a new quiz, or a full browser reload.

## Candidate Later Batches

| Candidate | Why later |
| --- | --- |
| Learning Studio profile-read seam | Its remaining `getAccountProfile`/`getCachedProfile` globals need separate account-transition characterization before consolidation. |
| Stale recovery summary calculations | Related to sync but carries backup, snapshot revision, and fail-closed state that needs a separate focused batch. |
| Learning Studio feature modules | Requires focused modal/tabs/deck tests per boundary. |
| CSS layer map and selector ownership | Needs visual regression and viewport coverage before pruning overrides. |
| Full ES module conversion | Too broad for incremental AUD-008 batches and would risk load-order regressions. |

## Remaining AUD-008 Risk

The frontend global-script finding is only partially fixed. The app still
depends on static script load order, large mutable global state, and a long CSS
override chain. Batches 1-3 and Finding 11 Batches 11A-11C create six small,
tested boundaries for import calculations, sync status rendering, profile
display, the AI Deck endpoint contract, Learning Studio storage access, and UI
action dispatch; they do not complete frontend modularization or CSS layering. Batch 11B removes
Learning Studio's direct `localStorage` and `accountStorageKey` use, but the new
facade itself remains ordered after `storage.js` and before Learning Studio.

## Finding 11 Batch 11B Extraction

`frontend/js/learning-studio-storage.js` introduces
`window.WordArenaLearningStudioStorage` with one narrow responsibility:

- read the current account's existing `quizHistory` JSON with the existing
  missing/malformed fallback;
- read and set the existing raw `focusStarted` and `deckImported` `"true"`
  flags;
- resolve every key through the existing current-account resolver without
  accepting an account id from UI callers.

Learning Studio retains UI state, rendering, import validation, vocabulary
`save()`, and cloud sync calls. The facade loads immediately before Learning
Studio, so this batch replaces one direct storage dependency with an explicit
facade seam but does not reduce static script-order coupling across the runtime.
The helper suite plus Playwright characterize missing/malformed storage,
offline reload, and A/B/A logout/relogin isolation.

## Finding 11 Batch 11C Extraction

`frontend/js/ui-actions.js` introduces `window.WordArenaUiActions` for the one
bounded responsibility previously split between `app.js`'s `UI_ACTIONS` map and
its special `start-challenge` branch:

- map the existing 15 action names to the same optional browser-global command
  functions;
- convert `data-challenge-seconds` with `Number(...)` and call the existing
  challenge command;
- leave unknown actions as no-ops.

`app.js` retains the document click listener, nearest-action lookup, and
`preventDefault`, but now consumes one facade instead of naming 16 action
globals. This reduces direct coordinator coupling without removing those global
providers from the runtime graph. `ui-actions.js` loads immediately before
`app.js`, so static script ordering remains.
