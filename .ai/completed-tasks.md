# Completed Tasks

## 2026-08-25 Audit Finding 11 Batch 11C

- Ranked profile reads, stale-recovery summaries, and delegated UI actions by coupling value and regression/security/sync risk before editing production code.
- Characterized desktop/mobile navigation, active-page state, native click/Enter behavior, single dispatch, and numeric challenge arguments before extraction.
- Extracted 15 action mappings plus the `start-challenge` argument branch into `window.WordArenaUiActions`; `app.js` retains one delegated listener and no longer names the 16 provider globals.
- Reduced `app.js` from 2,610 to 2,588 lines while keeping its 135 suppressions and the total 493 baseline unchanged.

Limitation:

- Finding 11 remains `PARTIALLY_FIXED`; the facade centralizes rather than removes classic-script globals, and static ordering plus large mutable coordinators remain.

## 2026-08-25 Audit Finding 11 Batch 11B

- Characterized Learning Studio account storage before extraction, including A/B/A logout/relogin, offline reload, empty keys, malformed JSON, and exact raw flag behavior.
- Extracted current-account `quizHistory`, `focusStarted`, and `deckImported` access into `window.WordArenaLearningStudioStorage` without changing keys, schema, identity, fallbacks, auth, or sync behavior.
- Removed all five direct `localStorage` calls and all direct `accountStorageKey` use from `learning-studio.js`; vocabulary `save()` and sync orchestration remain in Learning Studio.
- Reduced `learning-studio.js` from 1,551 to 1,543 lines and its ESLint suppression baseline from 34 to 28; total suppressions fell from 499 to 493.

Limitation:

- Finding 11 remains `PARTIALLY_FIXED`; the facade and application still use browser globals and static script ordering, and large responsibilities remain in `app.js`, `vocab.js`, and Learning Studio.

## 2026-08-25 Audit Finding 11 Batch 11A

- Characterized the AI Deck success request plus existing CSRF, rate-limit, retry, and malformed-response behavior before extraction.
- Extracted the `POST /api/ai/generate-deck` request and stable response/error parsing into `window.WordArenaAiDeckClient`.
- Kept Learning Studio UI, cooldown, validation, import behavior, auth transport, API contract, and local storage unchanged.
- Reduced `learning-studio.js` from 1,606 to 1,551 lines and its ESLint suppression baseline from 40 to 34 without mass formatting.

Limitation:

- Finding 11 remains `PARTIALLY_FIXED`; large script-global state and load-order coupling remain in `app.js`, `vocab.js`, and Learning Studio.

## 2026-08-24 Audit Finding 10 Bounded Scalability Remediation

- Added a reproducible 100/1,000/10,000-word H2 benchmark covering snapshot, progress, analytics overview, and limited review queue flows.
- Moved review priority ordering and `limit` into the database query while preserving visible order and filter behavior.
- Replaced `/api/progress` snapshot construction with targeted count/aggregate queries.
- Reused snapshot vocabulary rows for due counts and wrong-bank serialization, and removed the achievement lazy-load N+1.
- Removed the redundant analytics history count query without rewriting analytics semantics.
- Added observable parity tests and query/entity-load regression thresholds.

Limitations:

- Full snapshot payloads and analytics collection aggregation remain future architecture/query work.
- Tombstone and quiz-history retention remain blocked on a product/data policy decision.
- No API contract, schema, migration, deployment, cloud, or production database action was performed.

## 2026-08-24 Audit Findings 5-9

- Finding 5: added keyboard focus management to the Profile Editor and How It Works dialogs.
- Finding 6: added Vercel static CSP and browser security headers while preserving the documented inline-style compatibility boundary.
- Finding 7: exposed and adopted `X-Sync-Revision` across successful cloud mutations.
- Finding 8: made Mark Hard and Mark Known dedicated server-authoritative review actions.
- Finding 9: standardized canonical mastery at streak 5 and added revision-protected `wrongWordDeletions` so Clear Mastered persists without deleting unrelated entries.
- Added backend integration and Playwright regression coverage for the five findings.

Limitation:

- No commit, push, deploy, cloud action, production database action, or findings 10-13 work was performed.

## 2026-07-31 Audit Reconciliation And Hardening Evidence

- Verified input hashes for the supplied master command and `docs/technical-audit-report.md`.
- Confirmed `SOURCE_FILE_2` was not supplied in the workspace.
- Ran baseline and final local checks: backend tests, backend package, frontend syntax checks, Playwright smoke, release-gate controls, and `git diff --check`.
- Updated `docs/production-hardening-status.md` with an audit reconciliation matrix, status counts, item 1-7 completion, test evidence, score reassessment, and final `NOT_READY` gate.
- Added required source-of-truth files: `PROJECT.md`, `CLAUDE.md`, `docs/DOMAIN.md`, `docs/ROADMAP.md`, and `docs/TROUBLESHOOTING.md`.
- Updated release-gate secret/source scans so ignored local `.env` files and generated report directories do not create commit-safety false positives.
- Updated README, changelog, decisions, security, testing, and `.ai` state docs.

Decisions referenced:

- Keep local-first architecture.
- Keep OAuth2 session authentication with CSRF.
- Treat official progress as server-authoritative.
- Use Sync Contract V2 with stable UUID identity and tombstones.
- Use Flyway plus production `ddl-auto=validate`.
- Modularize frontend incrementally.
- Keep rate limiting in-memory until scale/cost/abuse evidence changes.

Limitations:

- No commit, push, deployment, production migration, staging smoke, or restore rehearsal was performed.
- Production gate remains `NOT_READY` pending external release evidence and a clean release candidate.

## 2026-07-31 SEC-01 Security Headers And Profile Hardening

- Added explicit Spring Security headers: CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, and HTTPS-gated HSTS.
- Added backend profile/avatar sanitizer for `/api/profile`, OAuth picture ingestion, and `ProfileDto` output.
- Restricted avatars to safe relative paths, `https://` URLs, and bitmap data images (`png`, `jpg/jpeg`, `gif`, `webp`).
- Rejected unsafe avatar schemes/data types such as `javascript:`, protocol-relative URLs, `data:text/html`, and SVG data images.
- Added frontend profile cache/render sanitization so unsafe stale localStorage avatars fall back to `images/icon.png`.
- Added profile photo upload checks for MIME type and size before preview/render.
- Added backend `SecurityHeadersTests`, `SecurityHeadersHstsTests`, and `ProfileSecurityTests`.
- Added Playwright coverage for profile save text rendering and unsafe avatar fallback.

Limitation:

- CSP still allows `unsafe-inline` because the static frontend currently uses inline handlers such as `onclick` and `oncontextmenu`.
