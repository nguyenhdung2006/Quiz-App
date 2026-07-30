# Changelog

## 2026-07-31

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
