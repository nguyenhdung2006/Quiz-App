# Changelog

## 2026-07-31

- Added Sync Contract V2 with required `syncContractVersion: 2`, stable `wordUid`, `deletions`, and tombstone-aware snapshots.
- Added `vocabulary.word_uid` and `word_tombstones` through `V3__add_word_uid_and_word_tombstones.sql`.
- Changed direct deletes to create tombstones and hard-delete live vocabulary rows.
- Updated frontend local/offline identity and delete queue to use stable `wordUid`.
- Added backend Sync V2 tests for UID rename, version enforcement, tombstone precedence, idempotent delete, rollback, and user isolation.
- Added CI PostgreSQL migration plus Hibernate validate step.
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
