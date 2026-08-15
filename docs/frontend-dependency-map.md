# Frontend Dependency Map

Last updated: 2026-08-15 +07

This document is the AUD-008 Batch 1 inventory for the current static
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
| 2 | `js/storage.js` | Local persistence facade used by vocabulary and app flows. |
| 3 | `js/vocab.js` | Vocabulary state, normalization, CRUD helpers, local save/load facade. |
| 4 | `js/ui.js` | Shared render/status/toast-style UI helpers. |
| 5 | `js/effects.js` | Effects helpers and UI decoration hooks. |
| 6 | `js/timer.js` | Quiz timer helpers. |
| 7 | `js/quiz.js` | Quiz state and answer/review flow. |
| 8 | `js/ai-explain.js` | Optional wrong-answer explanation helper. |
| 9 | `js/challenge.js` | Challenge helpers. |
| 10 | `js/main.js` | Startup normalization and initial UI wiring. |
| 11 | `js/import-helpers.js` | `window.WordArenaImport` pure import preview/merge helper namespace. |
| 12 | `js/app.js` | Auth, profile, cloud sync, stale recovery, import/export orchestration, app shell actions. |
| 13 | `js/curated-decks.js` | Curated deck UI/data helpers. |
| 14 | `js/learning-studio.js` | Learning Studio tabs, modal, deck generation/import UI. |
| 15 | `js/analytics-dashboard.js` | Analytics dashboard rendering. |
| 16 | `js/review-today.js` | Spaced repetition review UI. |

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
| `app.js` | `vocab.js` normalization/state helpers | Import, sync, and stale recovery rely on normalized word shape and local save/load behavior. |
| `app.js` | `ui.js`/existing notification facade | Import and sync flows surface status through existing UI helpers. |
| `quiz.js` and review scripts | vocabulary globals and render helpers | Existing Playwright tests characterize main study flows. |
| `learning-studio.js` | app/import public facades and DOM ids | Modal and import behavior depends on stable markup ids. |
| responsive CSS | preceding base/component/modern rules | Later files intentionally override earlier rules. |

## Public Facades To Preserve

Keep these stable until every consumer and regression test is moved:

- vocabulary state and helper globals from `vocab.js`;
- page/navigation helpers such as `showAppPage`;
- notification/status helpers such as `toast` or `showNotification` where present;
- render/update helpers such as `renderTable`, `renderMistakeTable`, and `updateStats`;
- cloud sync facade fields under `window.quizCloud`;
- import wrapper functions in `app.js`, now delegated to `window.WordArenaImport`;
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

## Candidate Later Batches

| Candidate | Why later |
| --- | --- |
| Sync status formatting/session labels | Good next low-risk extraction with text characterization tests. |
| Navigation action registry | Needs careful preservation of `data-ui-action` and mobile nav behavior. |
| Learning Studio feature modules | Requires focused modal/tabs/deck tests per boundary. |
| CSS layer map and selector ownership | Needs visual regression and viewport coverage before pruning overrides. |
| Full ES module conversion | Too broad for AUD-008 Batch 1 and would risk load-order regressions. |

## Remaining AUD-008 Risk

AUD-008 is only partially fixed. The app still depends on static script load
order, large mutable global state, and a long CSS override chain. Batch 1 creates
the dependency source of truth and extracts one small, tested import helper
boundary; it does not complete frontend modularization or CSS layering.
