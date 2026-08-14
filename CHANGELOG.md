# Changelog

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
