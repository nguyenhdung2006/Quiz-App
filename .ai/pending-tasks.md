# Pending Tasks

- Run a real browser Google OAuth2 login/logout E2E against the deployed frontend and backend with production cookies.
- Verify production environment keeps `SESSION_COOKIE_SAME_SITE=none`, `SESSION_COOKIE_SECURE=true`, exact `CORS_ALLOWED_ORIGINS`, and correct `FRONTEND_URL`.
- Rehearse `SPRING_PROFILES_ACTIVE=prod` against a copied/staging PostgreSQL database with current Flyway V1/V2 history before enabling the profile on production.
- Verify production `flyway_schema_history` state and record whether V1 baseline and V2 sync revision are present.
