# Testing

## Baseline Before CSRF Change

- `backend`: `.\mvnw.cmd test` passed with 57 tests.
- `backend`: `.\mvnw.cmd clean package -DskipTests` passed.
- `frontend`: `npm run test:frontend` passed with 24 Playwright tests.
- Frontend build script is not defined in `package.json`.
- Real Google OAuth browser E2E was not run in this local audit.

## CSRF Verification

Backend CSRF behavior is covered by `backend/src/test/java/com/quizapp/CsrfSecurityTests.java`:

- `GET /api/csrf` issues token JSON and `XSRF-TOKEN` cookie.
- Missing CSRF on unsafe API calls returns `403` JSON.
- Invalid CSRF on unsafe API calls returns `403` JSON.
- Valid CSRF allows authenticated unsafe writes.
- A valid CSRF token does not authenticate anonymous unsafe requests.
- Safe GET endpoints do not require CSRF.
- OAuth2 authorization GET is not blocked by CSRF.
- Logout requires CSRF and returns `204` when valid.
- CORS preflight allows configured origins and rejects an unknown origin.

Frontend CSRF behavior is covered in `tests/smoke.spec.js`:

- GET does not add CSRF.
- POST/PUT/DELETE add `X-XSRF-TOKEN` for trusted backend URLs.
- Third-party requests do not receive CSRF headers.
- Caller headers are preserved.
- `FormData` requests are not forced to JSON content type.
- Unsafe `403` is not retried automatically.
- Clearing CSRF memory forces the next unsafe request to fetch a new token.

## Verification Commands

```powershell
cd backend
.\mvnw.cmd clean test
.\mvnw.cmd clean package -DskipTests
```

Production database safety guard:

```powershell
cd backend
.\mvnw.cmd -Dtest=ProductionDatabaseSafetyGuardTests test
```

This test verifies:

- `application-prod.yml` pins Hibernate to `validate`.
- Production Flyway is enabled and validates migrations.
- Flyway clean is disabled.
- Production app startup rejects `baseline-on-migrate=true`.
- Unsafe effective overrides fail when `prod` is active.
- Migration files are ordered, contiguous, versioned, and do not contain tombstone work.

```powershell
npm run test:frontend
node --check frontend\js\config.js
node --check frontend\js\app.js
node --check frontend\js\ai-explain.js
node --check frontend\js\learning-studio.js
node --check frontend\js\review-today.js
node --check frontend\js\analytics-dashboard.js
node --check frontend\js\login.js
```
# Sync V2 Verification

Backend:

- `.\mvnw.cmd test` covers Sync V2 through `SyncContractV2Tests`.
- Covered invariants: required contract version, required `wordUid`, stable UID rename, tombstone precedence, idempotent repeated deletion, direct delete tombstone creation, atomic duplicate-English rollback, user isolation, existing CSRF/auth regressions.

Frontend:

- Run `node --check` against changed files: `frontend/js/app.js`, `frontend/js/vocab.js`, `frontend/js/main.js`, `frontend/js/quiz.js`, `frontend/js/review-today.js`.
- Run `npm run test:frontend` for Playwright smoke coverage.

PostgreSQL:

- CI starts PostgreSQL 16 and runs `SPRING_PROFILES_ACTIVE=prod ./mvnw -B -Dtest=QuizApplicationTests test` with Flyway enabled and Hibernate `ddl-auto=validate`.
- This verifies ordered V1 -> V3 migrations against PostgreSQL in CI. It does not execute a production or staging migration.
