# Project State

Date: 2026-07-30

The project keeps Google OAuth2 login with server-side Spring Security sessions. CSRF is enabled for unsafe requests using `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header.

Frontend backend calls are centralized through `window.quizApiFetch` in `frontend/js/config.js`. The helper keeps credentials for trusted backend requests, obtains CSRF tokens from `GET /api/csrf`, stores the token in memory only, and avoids adding CSRF to third-party requests.

Logout is now `POST /logout` with CSRF. Backend returns `204 No Content`; frontend redirects to `login.html?loggedOut=true`.

As of 2026-07-31, production database schema ownership is Flyway-first. `application-prod.yml` pins Hibernate `ddl-auto=validate`, Flyway enabled, validate-on-migrate enabled, clean disabled, and baseline-on-migrate disabled. `ProductionDatabaseSafetyGuard` fails startup for unsafe effective database settings when `prod` or `production` profile is active.
# 2026-07-31 Sync Contract V2 State

- Backend Sync V2 implemented through `com.quizapp.vocab.SyncService`.
- Stable identity: `VocabularyWord.wordUid` maps to `vocabulary.word_uid`; numeric `id` remains primary key.
- Tombstones: `WordTombstone` maps to `word_tombstones`; direct deletes hard-delete live rows and retain tombstones.
- Frontend creates/persists `wordUid`, sends `syncContractVersion: 2`, sends `deletions`, applies tombstones before live merge, and retries one rebuilt sync after 409.
- CI includes PostgreSQL migration/validate coverage.
