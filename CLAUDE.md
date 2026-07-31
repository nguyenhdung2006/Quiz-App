# CLAUDE.md

Operational guidance for agents working in this repository.

- Follow `AGENTS.md` as the primary agent instruction file.
- Keep changes small and focused.
- Preserve local-first frontend behavior.
- Preserve Google OAuth2 session authentication and CSRF.
- Do not introduce JWT, frontend frameworks, microservices, queues, or distributed infrastructure unless the task explicitly requires it.
- Do not commit secrets, `.env`, OAuth client files, or production credentials.
- Do not deploy, push, commit, or run production migrations unless explicitly instructed.
- Backend changes require `cd backend` then `.\mvnw.cmd test`.
- Frontend JavaScript changes require `node --check` for changed JS and Playwright smoke when behavior changes.
- Production readiness requires `docs/PRODUCTION_RELEASE_GATE.md`; local tests alone are not a production go decision.
