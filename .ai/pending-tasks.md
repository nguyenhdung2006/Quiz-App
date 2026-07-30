# Pending Tasks

- Run a real browser Google OAuth2 login/logout E2E against the deployed frontend and backend with production cookies.
- Verify production environment keeps `SESSION_COOKIE_SAME_SITE=none`, `SESSION_COOKIE_SECURE=true`, exact `CORS_ALLOWED_ORIGINS`, and correct `FRONTEND_URL`.
- Consider adding CI jobs for backend `clean test`, frontend Playwright smoke tests, and JavaScript syntax checks.

