# Completed Tasks

## 2026-07-31 Audit Reconciliation And Hardening Evidence

- Verified input hashes for the supplied master command and `docs/technical-audit-report.md`.
- Confirmed `SOURCE_FILE_2` was not supplied in the workspace.
- Ran baseline and final local checks: backend tests, backend package, frontend syntax checks, Playwright smoke, release-gate controls, and `git diff --check`.
- Updated `docs/production-hardening-status.md` with an audit reconciliation matrix, status counts, item 1-7 completion, test evidence, score reassessment, and final `NOT_READY` gate.
- Added required source-of-truth files: `PROJECT.md`, `CLAUDE.md`, `docs/DOMAIN.md`, `docs/ROADMAP.md`, and `docs/TROUBLESHOOTING.md`.
- Updated release-gate secret/source scans so ignored local `.env` files and generated report directories do not create commit-safety false positives.
- Updated README, changelog, decisions, security, testing, and `.ai` state docs.

Decisions referenced:

- Keep local-first architecture.
- Keep OAuth2 session authentication with CSRF.
- Treat official progress as server-authoritative.
- Use Sync Contract V2 with stable UUID identity and tombstones.
- Use Flyway plus production `ddl-auto=validate`.
- Modularize frontend incrementally.
- Keep rate limiting in-memory until scale/cost/abuse evidence changes.

Limitations:

- No commit, push, deployment, production migration, staging smoke, or restore rehearsal was performed.
- Production gate remains `NOT_READY` pending external release evidence and a clean release candidate.

## 2026-07-31 SEC-01 Security Headers And Profile Hardening

- Added explicit Spring Security headers: CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, and HTTPS-gated HSTS.
- Added backend profile/avatar sanitizer for `/api/profile`, OAuth picture ingestion, and `ProfileDto` output.
- Restricted avatars to safe relative paths, `https://` URLs, and bitmap data images (`png`, `jpg/jpeg`, `gif`, `webp`).
- Rejected unsafe avatar schemes/data types such as `javascript:`, protocol-relative URLs, `data:text/html`, and SVG data images.
- Added frontend profile cache/render sanitization so unsafe stale localStorage avatars fall back to `images/icon.png`.
- Added profile photo upload checks for MIME type and size before preview/render.
- Added backend `SecurityHeadersTests`, `SecurityHeadersHstsTests`, and `ProfileSecurityTests`.
- Added Playwright coverage for profile save text rendering and unsafe avatar fallback.

Limitation:

- CSP still allows `unsafe-inline` because the static frontend currently uses inline handlers such as `onclick` and `oncontextmenu`.
