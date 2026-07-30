# Pending Tasks

- Run a real browser Google OAuth2 login/logout E2E against the deployed frontend and backend with production cookies.
- Verify production environment keeps `SESSION_COOKIE_SAME_SITE=none`, `SESSION_COOKIE_SECURE=true`, exact `CORS_ALLOWED_ORIGINS`, and correct `FRONTEND_URL`.
- Rehearse `SPRING_PROFILES_ACTIVE=prod` against a copied/staging PostgreSQL database with current Flyway V1/V2 history before enabling the profile on production.
- Verify production `flyway_schema_history` state and record whether V1 baseline and V2 sync revision are present.
# 2026-07-31 Pending Sync V2 Operations

- Run a staging/copy database rehearsal for V1 -> V4 before production deployment.
- Fix Render backend env/profile before redeploy: production backend must run with `SPRING_PROFILES_ACTIVE=prod` or Flyway enabled plus Hibernate validate.
- Confirm production frontend and backend are deployed together so clients send Sync Contract V2.
- Monitor 400 `SYNC_CLIENT_UPGRADE_REQUIRED` counts after deployment to detect stale clients.
