# Changelog

## Unreleased

- Finding 12 Batch 12D: added bounded physical cleanup for consumed quiz attempts, expired abandoned attempts after a seven-day grace, and accepted review operations. Cleanup runs after committed ledger traffic at most hourly per process, deletes oldest eligible UUIDs in 500-row category batches, and cannot mutate learning/rewards/revisions or quiz history.
- Added V8 portable retention indexes and deterministic strict-cutoff, cascade, replay-after-delete, failure-isolation, throttle, concurrency, H2, and PostgreSQL migration coverage. Human review approved Batch 12D and **Finding 12 — FIXED**; no deployment is included.

## 2026-08-28

- Finding 12 Batch 12B: migrated supported online quizzes to server-issued attempts, bound each question to its issued context, and made submit/lost-response retries reuse the same attempt and payload. Offline or failed-issuance rounds stay local-only without retroactive cloud rewards.
- Retired `POST /api/quiz-results` with deterministic, non-mutating `410 Gone` and permanent exploit regression coverage; no automatic create-and-submit compatibility shim remains.
- Added V6 immutable achievement-XP outcome metadata alongside quiz XP, score, combo, and original revision; exact replay does not award again. Late responses are isolated from replacement quizzes and other accounts.
- At the Batch 12B boundary Finding 12 was partially fixed; Review Today,
  Mark Known/Hard, and seven-day physical cleanup were subsequently completed
  by approved Batches 12C/12D. Deployment version skew still requires
  backend-first sequencing; these batches have not been deployed.

## 2026-08-25

- Partially remediated Finding 12 with server-issued online quiz attempts, captured answer context, server-authoritative scoring, transactional at-most-once mutation, 24-hour expiry, and idempotent exact retry; at the Batch 12A boundary the legacy frontend reward path and review replay remained open (quiz legacy closure is recorded above in Batch 12B).
- Continued partial Finding 11 remediation by extracting the delegated `data-ui-action` command registry from `app.js`, preserving desktop/mobile navigation, active-page, click/keyboard, and challenge behavior.
- Continued partial Finding 11 remediation by extracting Learning Studio's current-account history/flag storage access while preserving exact keys/schema, offline reload behavior, and A/B/A logout/relogin isolation.
- Partially remediated Finding 11 by extracting the characterized AI Deck endpoint client from Learning Studio while preserving CSRF, request/error semantics, UI behavior, and the static script architecture.

## 2026-08-24

- Partially remediated Finding 10 with measured DB-side review limiting, targeted progress aggregates, snapshot query reuse/N+1 removal, analytics query deduplication, and a repeatable 100/1,000/10,000-word benchmark; full snapshot/analytics scaling and retention policy remain open.
- Finding 5: added keyboard focus containment, Escape close, and opener focus restoration to the Profile Editor and How It Works dialogs.
- Finding 6: added static Vercel CSP and browser security headers without `unsafe-eval` or script `unsafe-inline`.
- Finding 7: propagated `X-Sync-Revision` on successful backend mutations so subsequent syncs use the server-issued baseline without weakening real conflict detection.
- Finding 8: made Mark Hard and Mark Known server-authoritative, with intent-only frontend requests.
- Finding 9: kept wrong-bank entries active until canonical mastery at streak 5 and added revision-protected persistence for clearing only mastered entries.

## 2026-08-20

- Corrected validation and bad-request log classifications so they no longer appear as authentication failures.
- Restored normal browser context menus by removing the application-wide right-click cancellation.
- Redirected failed Google OAuth attempts to the configured frontend login page with `?error=oauth` instead of restarting authorization.
- Hardened the backend runtime image with a dedicated non-root user and a focused Docker build context.

## 2026-08-15

- Hardened Learning Studio modal accessibility with initial focus, Tab/Shift+Tab focus trap, Escape close, opener focus restore, ARIA dialog description, ARIA tab/panel state, roving tabindex, and keyboard tab navigation tests.
- Compacted mobile app-shell navigation by keeping primary routes visible, moving secondary tools into a keyboard-usable disclosure, wrapping sync status text safely, and adding viewport overflow tests for 320, 390, 768, and desktop widths.
- Removed inline event handlers from the main frontend markup, moved those actions to delegated JavaScript listeners, removed `script-src 'unsafe-inline'` from enforced CSP, and added a stricter CSP report-only header while keeping `style-src 'unsafe-inline'` pending a style cleanup phase.
- Reduced JavaScript inline-style writes from 45 to 32 by moving quiz timer/button visibility, progress reset transitions, and result tones to semantic attributes and CSS; added an exact allowlisted inline-style ratchet to local checks, CI, and the release gate.
- Continued AUD-011 by moving app/studio toast dismissal state from JavaScript inline styles to `.toast.is-hiding`, reducing the inline-style ratchet from 32 to 27 while keeping enforced `style-src 'unsafe-inline'` pending the remaining clusters.
- Reconciled API/testing/product/backend docs against current controllers, public route policy, Flyway V4, and CSV import/template support; added a local docs drift check.
- Replaced native-confirm JSON import with an accessible review dialog, explicit Merge/Replace/Cancel actions, automatic backup-before-replace, local-wins duplicate handling, capacity probing, rollback on storage failure, and malformed/large/quota/mobile regression tests.
- Made backend analytics calendar dates deterministic with an injected clock and configurable `ANALYTICS_DEFAULT_ZONE` (UTC by default), including UTC/New York boundary, DST overlap, invalid-config fallback, and host-timezone independence tests.
- Added frontend syntax and ESLint quality gates with a legacy suppressions baseline, plus backend JaCoCo coverage reports and an 80% line coverage threshold wired into CI/release-gate checks.
- Removed unreferenced `design-system.css` and `login-modern.css`, documented the runtime stylesheet source of truth, and added a CSS asset ownership check.
- Protected Actuator metrics from anonymous access, kept health/info public and minimal, and documented alert/SLO ownership while leaving real alert delivery evidence as required external work.
- Added the AUD-008 frontend dependency map, extracted import preview/merge calculations into `window.WordArenaImport`, and added a characterization test while keeping the existing `app.js` compatibility wrappers.
- Continued AUD-008 with a focused `window.WordArenaSyncStatus` extraction for sync copy/rendering, accessible full-text labels, tone classes, and Retry visibility, backed by characterization tests and thin `app.js` wrappers.
- Continued AUD-008 with `window.WordArenaSessionUi` for profile display modeling and safe DOM rendering while keeping auth, profile sanitization, account persistence, and leaderboard orchestration in `app.js`.
- Routed the Vercel public root to `login.html` while preserving `index.html` as the explicit post-OAuth app entry, with Playwright coverage for both public login URLs.

## 2026-08-11

- Hardened the production release gate so production environment validation is
  separate from validator fixtures and requires redacted deployment evidence.
- Hardened the staging release gate so health/CSRF/frontend checks cannot pass
  as full staging evidence without real authenticated OAuth/session,
  CRUD/sync/delete/logout smoke evidence.
- Added release-gate tests for production env validation and stale control
  artifact blocking.
- Updated release-gate docs/status to keep missing real deployment env as
  `BLOCKED`, not production readiness.
- Added a configurable pre-deserialization `/api/sync` request body cap with a
  `413 Payload Too Large` JSON error envelope.
- Added a feature-flagged stale-device recovery entry point that blocks stale
  push/apply paths, supports local backup export and backup-first `Use cloud`,
  and keeps unsafe merge/local-as-new choices disabled until a reliable baseline
  exists.
- Added AUD-005 capacity measurements for snapshot/sync/quiz/review/analytics
  and reduced backend query cost with stats fetch graphs, quiz bulk lookups,
  sync map reuse, review due prefiltering, and analytics overview list reuse.
  Full snapshot payloads and tombstone retention remain open design risks.

## 2026-07-31

- Added explicit Spring Security response headers with compatible CSP, Referrer-Policy, X-Content-Type-Options, frame deny policy, and HTTPS-gated HSTS.
- Hardened profile/avatar handling across backend input/output, OAuth picture ingestion, frontend cache, upload preview, and image rendering.
- Added backend security/profile regression tests and Playwright profile save/render coverage.
- Reconciled production hardening status against the technical audit and current test evidence.
- Updated release-gate secret/source scans so ignored local `.env` and generated report folders do not create false commit-safety failures.
- Added missing source-of-truth docs: `PROJECT.md`, `CLAUDE.md`, `docs/DOMAIN.md`, `docs/ROADMAP.md`, and `docs/TROUBLESHOOTING.md`.
- Reclassified production gate as `NOT_READY` until production env, staging smoke, restore rehearsal evidence, and clean source integrity are proven.
- Added Sync Contract V2 with required `syncContractVersion: 2`, stable `wordUid`, `deletions`, and tombstone-aware snapshots.
- Added `vocabulary.word_uid` and `word_tombstones` through `V3__add_word_uid_and_word_tombstones.sql`.
- Changed direct deletes to create tombstones and hard-delete live vocabulary rows.
- Updated frontend local/offline identity and delete queue to use stable `wordUid`.
- Added backend Sync V2 tests for UID rename, version enforcement, tombstone precedence, idempotent delete, rollback, and user isolation.
- Added CI PostgreSQL migration plus Hibernate validate step.
- Added V4 tombstone `legacyWordId` support to prevent deleted legacy local words from being recreated with a newly generated client UUID.
- Added `application-prod.yml` to pin production database safety settings.
- Added `ProductionDatabaseSafetyGuard` to fail startup when prod/production profile uses unsafe Hibernate or Flyway settings.
- Added production database safety tests for prod profile values, unsafe overrides, migration ordering, and tombstone exclusion.
- Documented Flyway as the production schema source of truth and clarified `database/schema.sql` as reference/legacy repair material only.
- Updated CI to run production database safety guards.

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
