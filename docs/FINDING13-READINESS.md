# Finding 13A Production Readiness Evidence Matrix

Date: 2026-09-03

Finding 13 evidence candidate: `a7259fe48d2ab364408a5912c7dafec5bf318d92`

Branch: `chore/audit-reconciliation-and-upgrade`

Latest migration: V8 (`V8__add_retention_cleanup_indexes.sql`)

Decision: **OPEN / NO-GO — EXTERNAL RELEASE EVIDENCE REQUIRED**

This SHA is an evidence candidate for Finding 13A, not the final production
release candidate. Findings 14–16 remain unresolved, and any SHA-bound release
evidence must be regenerated for the eventual final candidate. This review did
not deploy, access a cloud control plane, change production environment
variables, or access a production database.

## Evidence Matrix

| Control | Required evidence | Current evidence | Status | Exact next action | Requires operator/cloud? |
| --- | --- | --- | --- | --- | --- |
| Candidate provenance | Branch, exact SHA, clean tree, latest migration | Branch/SHA verified; local and remote branch both pointed to `a7259fe...` before this uncommitted 13A diff; V8 is latest | BLOCKED | Review/commit approved 13A changes, finish Findings 14–16, select the final SHA, and rerun all SHA-bound controls from a clean checkout | No now; operator later |
| Source integrity | Clean exact-candidate checkout, unique migrations, safe production config, ignored generated outputs | Local gate reached Git only outside the sandbox and correctly failed because the 13A worktree plus three required untracked audit artifacts is dirty; no duplicate migration versions found | FAIL | Run `npm run gate:source-integrity` in a clean checkout of the eventual candidate; do not delete, hide, ignore, or stage the three audit artifacts merely to make this workspace clean | No |
| Secret scan | Tracked and non-ignored untracked source contains no secret material | Fresh `npm run gate:secret-scan` PASS on this worktree; no values were printed | PASS | Rerun on the final clean SHA in GitHub Actions | No |
| Backend full tests and coverage | Maven verify plus JaCoCo gate on candidate code | Reused current-code Finding 12D evidence because backend application code did not change: 169/169 PASS in 29 suites; JaCoCo 88.57% lines (2704/3053), 63.34% branches (781/1233) | PASS | Rerun `./mvnw -B verify` on the final SHA | No |
| Focused security/observability/sync | Hardening, CSRF, observability, rate-limit, and sync contract suites | Fresh combined run: 54/54 PASS | PASS | Rerun through the exact workflow on the final SHA | No |
| Frontend lint/build/static controls | ESLint, static build, CSS ownership, inline-style ratchet, syntax and helper suites | Fresh PASS: ESLint; static build; 25 JS files; 10 stylesheets; 27 allowlisted usages/9 files; 8 helper suites, including review helper 12/12 | PASS | Rerun through the exact workflow on the final SHA | No |
| Frontend browser tests | Full Chromium suite on candidate | Fresh 105/105 PASS | PASS | Rerun through the exact workflow on the final SHA | No |
| Flyway V1→V8 | Fresh PostgreSQL 16 migration, repeat startup, Flyway and Hibernate validation | Reused exact current-code Finding 12D evidence: PostgreSQL 16.14 fresh V1→V8 and restart validation PASS; migrations V1–V8 are present | PASS | Rerun the workflow PostgreSQL service rehearsal on the final SHA; separately prove deployed schema V8 during authorized rollout | No now; operator for rollout |
| Production environment | Redacted provenance plus prod profile, PostgreSQL URL, validate-only JPA, Flyway enabled/baseline false, exact HTTPS frontend/CORS/OAuth redirect, secure `SameSite=None` cookie path `/`, non-debug logging, Google variables present | Local validator self-tests PASS 7/7 after closing OAuth/cookie validation gaps; actual values/evidence are absent, so `gate:validate-env` is BLOCKED with 21 findings | BLOCKED | Load repository/environment secrets and variables without printing them; provide `RELEASE_ENV_SOURCE`, `RELEASE_DEPLOYMENT_ID`, `RELEASE_ENV_CAPTURED_AT`; run validator for the exact deployment | Yes |
| GitHub Production Release Gate | `Production Release Gate` workflow report is GO for exact final SHA | Workflow exists at `.github/workflows/production-release-gate.yml`; no current exact-SHA Actions run/report exists; local report artifacts are mixed/stale and not authoritative | NOT_RUN | After all evidence exists, manually run the workflow on the final candidate and retain `production-release-gate-report` | Yes |
| Render deployment provenance | Service name/ID, tracked branch, deployed SHA/ID/time, root `backend`, Dockerfile path, image digest, runtime UID, instance/memory limit, health | Repository Dockerfile provenance is `9f48d056...`; current file builds Java 17 and runs UID/GID 10001. No control-plane evidence proves Render uses it. Old log said `started by root in /app` | BLOCKED | Capture redacted Render service/deploy metadata and startup log proving exact SHA/image/root/non-root runtime, plus `/api/health` and `/actuator/info` | Yes |
| Render exit 137/memory | Platform event, limit, metrics around incident/latest restart, classification, alert evidence | Historical screenshots record a memory-limit event on 2026-08-07 23:18 and recovery at 23:23; quantitative metrics, latest-event confirmation, root cause, and delivered alert evidence are absent | BLOCKED | Record instance memory limit, current memory/CPU trend, latest restart/OOM events, deploy association, investigation result, and a delivered alert or documented monitoring channel | Yes |
| Vercel provenance/routing/headers | Project/deploy ID, exact SHA/time, root `frontend/`, active `vercel.json`, backend origin, served routes and headers | Repository config provenance: `vercel.json` last changed at `0800b6f...`; latest frontend change `6fc9c0...`; configured backend is `https://quiz-app-xd9m.onrender.com`. No Vercel deployment proof exists | BLOCKED | Capture redacted Vercel metadata and verify `/`, `/login.html`, `/index.html`, actual security headers, and backend origin on the exact deployed frontend | Yes |
| Google OAuth/session | Console origin/callback configuration and real cross-site login, CSRF, unsafe request, logout invalidation | Repository callback is `/login/oauth2/code/google`; configured success target is `/index.html`; code/config tests are not Google Console or deployed-cookie evidence | BLOCKED | Verify allowed frontend origin as applicable, exact backend callback URI, post-login redirect, credentialed CORS, `Secure; SameSite=None; Path=/`, `/api/csrf`, authenticated unsafe request, and logout/session invalidation | Yes |
| Authenticated staging smoke | Complete evidence table for same SHA: auth, CSRF, unsafe CRUD, sync revision, tombstone/no resurrection, current quiz/review paths, logout | `docs/staging-auth-smoke-evidence.md` is missing; direct local gate is BLOCKED; checklist is preparation only | BLOCKED | Deploy only to an authorized staging/disposable environment, execute the checklist with a test identity, add current SHA and quiz/review results, then run `gate:staging-smoke` | Yes |
| Backup/restore rehearsal | Real backup reference/verification, disposable restore, Flyway/app compatibility, app startup and restored `/api/health`, operator/time | Tracked 2026-08-08 evidence is explicitly partial and only reaches V4; it has no backup artifact/verification and no restored app health smoke. Gate is BLOCKED | BLOCKED | Use a non-production/sanitized backup, restore to a disposable database, validate through V8, start the app, smoke health, and record the complete redacted table. Use `RELEASE_RESTORE_REHEARSAL_EVIDENCE_FILE` only for an equivalent complete reviewed file | Yes |
| Migration/rollback | Forward-only migrations, schema-compatible app rollback, no Flyway clean, explicit version-skew order | Runbook now states backend/migrations V1→V8 first, verify, frontend second; V1–V7 immutable; pre-V7 backend rollback with the new frontend is forbidden | PASS | During an authorized release, record backup, V8 validation, backend health, frontend cache refresh, and rollback/forward-fix decision points | Yes for execution |
| Monitoring/alerts | Health/restart/5xx/DB/AI/sync signals connected to a real channel with owner and delivered notification evidence | Thresholds and owners are documented only; no connected alert backend or delivery proof. Exit-137 monitoring is unresolved | BLOCKED | Connect or identify the actual monitoring/alert channel and retain a delivered test notification plus dashboard/event evidence | Yes |
| Final GO/NO-GO | Every mandatory control PASS for same final SHA and deployment evidence | External controls remain BLOCKED and exact-SHA workflow is NOT_RUN | BLOCKED | Keep NO-GO until all rows are PASS on the eventual post-Findings-14–16 candidate | Yes |

## Provenance Inventory

- Evidence candidate: `a7259fe48d2ab364408a5912c7dafec5bf318d92` on
  `chore/audit-reconciliation-and-upgrade`.
- Dockerfile last-change commit: `9f48d056298e8f3d6a2770b0b3958376a823ecb6`.
- Latest commit touching production frontend files:
  `6fc9c0c4dd001f11cc2b7a97c222bc61263f2411`.
- `frontend/vercel.json` last-change commit:
  `0800b6f55ac88c09a4a5755806b9e2a1a68d80b1`.
- Production release workflow last-change commit:
  `39e410d4e26e19e80bf96f123b649f4c562a38a6`.
- Repository migrations are V1 through V8; the latest is
  `V8__add_retention_cleanup_indexes.sql`.

These repository facts do not prove what Render, Vercel, Supabase, or Google
currently runs or contains.

## Old Evidence Classification

- `release-gate-artifacts/` is ignored generated output. Its retained controls
  mix July/August entries without a commit SHA, old commits, and this dirty
  worktree. It is not a valid exact-candidate report.
- `docs/restore-rehearsal-evidence.md` is incomplete and stale at V4. It is
  useful history but not backup/restore readiness.
- `docs/flyway-baseline-rehearsal.md` is historical schema/baseline evidence,
  not a current V8 data-restore rehearsal.
- the 2026-08-08 release notes and Render screenshots are historical. They prove
  an event occurred, not the current deployed artifact, capacity, or alerting.
- `docs/staging-auth-smoke-checklist.md` is a template; the corresponding
  evidence file is absent.
- production-environment safe/unsafe fixtures prove validator behavior only.
  They are intentionally rejected as deployed environment evidence.

## GitHub Workflow Safety

The manually callable workflow is named `Production Release Gate`. It checks
out source, starts a disposable PostgreSQL 16 service, runs local tests and
validators, reads configured repository/environment variables and secrets, and
uploads test/report artifacts. Inspection found no deployment action, provider
CLI, production database command, or cloud write. It is safe as a
pre-production gate, but this batch does not authorize or trigger it.

The workflow requires deployed-environment metadata and configuration, staging
URLs/test-user hint, a complete authenticated staging evidence file, and a
complete restore evidence file. With current evidence, production env,
backup/restore, and staging controls predictably remain BLOCKED; the final report
therefore remains NO-GO. Source integrity will pass only from a clean checkout.

## Exact Authorized Release Sequence

1. Finish Findings 14–16 and choose a clean final candidate SHA.
2. Create and verify the required backup, then complete the disposable restore
   rehearsal and restored-target health smoke.
3. Run the complete authenticated smoke on staging for that SHA.
4. Run the GitHub Production Release Gate and require GO for that same SHA.
5. In an authorized maintenance window, deploy the backend first so Flyway
   validates/applies through V8; confirm profile, schema, health, info, logs,
   runtime UID, and memory headroom.
6. Deploy the frontend second, refresh caches, and verify Vercel routing,
   headers, backend origin, OAuth/session/CSRF/logout, sync, quiz, and review.
7. If application rollback is required, use only a schema-compatible build.
   Never return to a pre-V7 backend while the new frontend is served, edit an
   applied migration, or use Flyway clean in production; prefer a forward fix.

## Operator Evidence Checklist

- Render: service and deploy IDs, tracked branch, exact SHA, root directory,
  Dockerfile/image digest, runtime UID, instance/memory limit, latest
  restart/OOM event, health/info, and alert/metrics evidence.
- Vercel: project/deployment IDs, exact SHA, root directory, active config,
  backend origin, three route responses, and actual response headers.
- Google/session: redacted Console origin/callback metadata and timestamped
  cross-site login, post-login redirect, cookie, CORS, CSRF, unsafe mutation,
  logout, and post-logout denial results.
- Staging: complete `docs/staging-auth-smoke-checklist.md` evidence for the same
  SHA, including current quiz-attempt and review-operation flows.
- Restore: a real non-production/sanitized backup reference and verification,
  disposable restore, V8 Flyway/Hibernate validation, app startup, health smoke,
  operator, timestamp, and no sensitive data in the committed evidence.
