# AGENTS.md

## Project Overview

Quiz App is an AI Vocabulary Learning Platform with:

- Static HTML/CSS/JavaScript frontend.
- Spring Boot backend with Google OAuth session auth.
- Local-first vocabulary storage with cloud sync when authenticated.
- Vocabulary CRUD, quiz history, wrong-bank review, analytics, spaced repetition, and optional AI wrong-answer explanations.
- H2 for quick local backend startup and PostgreSQL/Supabase for production.

## Repository Structure

```text
frontend/   Static HTML, CSS, JavaScript, images, sounds
backend/    Spring Boot REST API, OAuth2 login, services, tests, Dockerfile
database/   PostgreSQL schema
docs/       Deployment, OAuth, product, and backend notes
archive/    Legacy snapshots kept for reference
```

## Frontend Structure

Main files:

- `frontend/index.html` - main app shell.
- `frontend/login.html` - Google login page.
- `frontend/js/config.js` - frontend API origin config. Local defaults to `http://localhost:8080`; production Vercel points to Render.
- `frontend/js/app.js` - auth guard, profile/cloud sync, vocabulary API calls, import/export, logout.
- `frontend/js/login.js` - login page behavior and Google OAuth start.
- `frontend/js/vocab.js` - local vocabulary data behavior.
- `frontend/js/quiz.js` - quiz and answer review flow.
- `frontend/js/ai-explain.js` - wrong-answer explanation API/fallback.
- `frontend/js/analytics-dashboard.js` - analytics dashboard.
- `frontend/js/review-today.js` - spaced repetition review flow.
- `frontend/css/` - styling.

## Backend Structure

Main packages:

- `com.quizapp.auth` - `/api/me`, profile update.
- `com.quizapp.config` - Spring Security, OAuth2, CORS.
- `com.quizapp.user` - current user lookup, app user entity/repository, profile DTOs.
- `com.quizapp.vocab` - vocabulary entities, repositories, DTOs, CRUD, sync, quiz history, achievements.
- `com.quizapp.analytics` - learning analytics endpoints and aggregation.
- `com.quizapp.review` - spaced repetition review queue and answer handling.
- `com.quizapp.ai` - optional OpenAI wrong-answer explanation with rule-based fallback.
- `com.quizapp.health` - public `/api/health`.
- `com.quizapp.shared` - API error response and global exception handling.

Important backend files:

- `backend/src/main/resources/application.yml` - OAuth, frontend redirect, CORS, AI, session cookie config.
- `backend/src/main/resources/application.properties` - datasource defaults and JPA settings.
- `backend/Dockerfile` - Render Docker deployment.
- `database/schema.sql` - PostgreSQL schema.

## Auth And Session Notes

- Backend uses Spring Security OAuth2 login with Google.
- Frontend starts login by redirecting to backend `/oauth2/authorization/google`.
- Google callback returns to backend `/login/oauth2/code/google`.
- Backend stores login in `JSESSIONID`.
- Frontend calls `/api/me` with `credentials: "include"` to verify session.
- Production Vercel + Render requires:
  - `CORS_ALLOWED_ORIGINS=https://quiz-app-rust-iota-39.vercel.app`
  - `FRONTEND_URL=https://quiz-app-rust-iota-39.vercel.app`
  - `SESSION_COOKIE_SAME_SITE=none`
  - `SESSION_COOKIE_SECURE=true`
  - `SESSION_COOKIE_PATH=/`
- Local defaults must continue to work with localhost and local-first fallback.

## Commands

Run backend tests:

```powershell
cd backend
.\mvnw.cmd test
```

Build backend jar:

```powershell
cd backend
.\mvnw.cmd clean package -DskipTests
```

Run backend locally:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Check changed frontend JavaScript:

```powershell
node --check frontend\js\config.js
node --check frontend\js\app.js
node --check frontend\js\login.js
node --check frontend\js\ai-explain.js
node --check frontend\js\analytics-dashboard.js
node --check frontend\js\review-today.js
```

## Deployment Notes

Backend on Render:

- Use Docker.
- Root directory: `backend`.
- Dockerfile path: `./Dockerfile`.
- Health check path: `/api/health`.
- Render provides `PORT`; Dockerfile starts Spring Boot with `-Dserver.port=${PORT:-8080}`.

Frontend on Vercel:

- Static frontend from `frontend/`.
- `frontend/js/config.js` detects Vercel and uses Render backend URL.
- Keep production backend URL changes focused in `config.js`.

Database on Supabase/PostgreSQL:

- Use PostgreSQL connection details as environment variables.
- Do not commit database passwords.
- Production should use `JPA_DDL_AUTO=validate` after applying `database/schema.sql`.

Google OAuth:

- Authorized JavaScript origin should include the Vercel frontend.
- Authorized redirect URI should include the Render backend callback:
  `https://quiz-app-xd9m.onrender.com/login/oauth2/code/google`.

AI:

- `OPENAI_API_KEY` is optional.
- Without it, backend must use rule-based fallback.
- Never expose OpenAI keys to frontend code.

## Safety Rules For Agents

- Make small focused changes only.
- Do not refactor unrelated code.
- Do not change database schema unless explicitly requested.
- Do not change backend OAuth/session logic unless the task specifically requires it.
- Do not break local-first fallback behavior.
- Do not hardcode secrets, API keys, passwords, or tokens.
- Do not remove archive or legacy files unless explicitly confirmed.
- If there are conflicts, unclear logic, failing tests, dependency problems, or risky changes, stop and report instead of auto-fixing.
- If a change touches frontend JavaScript, run `node --check` on every changed JS file.
- If a change touches backend code or backend config, run `cd backend` then `.\mvnw.cmd test`.
- After every change, explain:
  - files changed
  - tests/checks run
  - any risks or follow-up deployment settings required
