# Quiz App

Quiz App is an AI Vocabulary Learning Platform with local-first vocabulary study,
Google-login cloud sync, analytics, spaced repetition, and optional AI
explanations for wrong answers.

## Features

- Add, edit, delete, favorite, search, and filter vocabulary words.
- Store learning-focused word profiles: POS, tag, IPA, CEFR/IELTS level, context, example meaning, collocations, synonyms, antonyms, common mistakes, notes, mastery, and review stats.
- Quiz modes: English to Vietnamese, Vietnamese to English, mixed, favorites, wrong words, daily challenge, and timed challenge.
- Answer review, wrong bank, combo feedback, sound effects, pronunciation, and JSON backup.
- Profile, XP, level, achievements, weekly progress, due reviews, starter sample words, topic decks, and CSV import templates.
- Spring Boot backend with Google OAuth, PostgreSQL/H2, vocabulary CRUD, sync, quiz history, achievements, analytics, spaced repetition, and optional OpenAI-powered explanations with fallback.

## Tech Stack

- Backend: Spring Boot, Spring Security OAuth2, Spring Data JPA, Bean Validation.
- Database: H2 for local quick start, PostgreSQL for production.
- Frontend: static HTML, CSS, and JavaScript.
- AI: OpenAI Responses API through backend only; `OPENAI_API_KEY` is optional.
- Build: Maven wrapper for backend.

## Project Structure

```text
frontend/   Static HTML, CSS, JavaScript, images, sounds
backend/    Spring Boot REST API and Google OAuth
database/   PostgreSQL schema reference
docs/       Current docs, audit reconciliation, operations notes
archive/    Old project snapshots kept for reference
```

## Run Frontend

Open `frontend/login.html` or serve the repo with a static server such as Live Server on port `5500`.

Frontend backend URL defaults to `http://localhost:8080` in `frontend/js/config.js`.

## Run Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

By default the backend uses H2 memory storage. For PostgreSQL, see `docs/backend-postgres.md`.

Copy `.env.example` to `.env` for local secrets. Do not commit `.env`.

## Google Login

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then run the backend. The Google callback is:

```text
http://localhost:8080/login/oauth2/code/google
```

More detail is in `docs/oauth-google.md`.

## Documentation

Start with `docs/README.md` for the current reading order. Historical audit
material is preserved under `docs/archive/`; do not treat old findings as
current without checking source.

## Deploy

See `docs/DEPLOYMENT.md`, `docs/deploy.md`, and
`docs/PRODUCTION_RELEASE_GATE.md` for production environment variables, Render
backend setup, frontend static hosting, Google OAuth production URLs, Flyway
rollout, health checks, rollback requirements, and AI cost notes.

Production release is gated. A local code/test pass is not the same as a
production go decision; the release gate also requires clean source integrity,
valid production environment variables, staging smoke evidence, and restore
rehearsal evidence.

Current source is hardened beyond the old 5.6/10 audit baseline, but the project
should not be described as production-ready until open blockers in
`docs/technical-audit-report.md` and `docs/ROADMAP.md` are closed and verified.

## Verify

```powershell
cd backend
.\mvnw.cmd test
```

Additional local checks:

```powershell
npx playwright test
npm run gate:secret-scan
npm run gate:report
```
