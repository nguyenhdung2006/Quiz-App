# Project

Name: WordArena / Quiz App.

Problem: learners need a local-first vocabulary practice app that remains useful offline while allowing authenticated cloud backup, review history, analytics, and optional AI help.

Users: individual English learners, especially self-study users who build personal vocabulary banks.

Stage: hardened beta / staging candidate. Code-level P0 hardening is implemented and tested, but the production release gate is currently `NOT_READY` because production env, staging smoke, restore rehearsal evidence, and clean source integrity are not all proven in this workspace.

In scope:

- Static HTML/CSS/JavaScript frontend.
- Spring Boot modular monolith backend.
- Google OAuth2 session login.
- Local-first vocabulary CRUD and cloud sync.
- Server-authoritative quiz/progress, wrong bank, achievements, spaced review, analytics.
- Optional OpenAI-backed explanation/deck generation with rule fallback.
- Flyway-managed production schema evolution.

Out of scope:

- React/Vue rewrite.
- JWT migration solely for CSRF.
- Microservices, queues, CQRS, event sourcing, or CRDT sync.
- Distributed rate limiting until multi-instance deployment, material AI cost risk, or abuse evidence exists.

Stack:

- Frontend: static HTML, CSS, JavaScript, Playwright smoke tests.
- Backend: Java 17 target, Spring Boot, Spring Security OAuth2, Spring Data JPA, Bean Validation, Actuator.
- Database: H2 for local/test, PostgreSQL/Supabase for production, Flyway migrations.
- AI: backend-only OpenAI API integration; `OPENAI_API_KEY` optional.

Constraints:

- Do not commit secrets.
- Keep local-first fallback working.
- Production must use Flyway and Hibernate `ddl-auto=validate`.
- Server decides XP, level, achievements, official stats, review schedule, revisions, timestamps, ownership, and tombstones.

Stakeholders: `UNKNOWN - cần xác nhận`.

Success metrics:

- Backend full tests pass.
- Playwright smoke tests pass.
- Production release gate passes all mandatory controls before deployment.
- No forged quiz/sync payload can mint official progress.
- Deleted synced words do not resurrect across devices.
