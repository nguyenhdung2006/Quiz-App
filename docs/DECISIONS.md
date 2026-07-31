# Architecture Decisions

## ADR-001: Flyway Owns Production Schema

Status: Accepted

Production schema evolution is owned by Flyway migrations in `backend/src/main/resources/db/migration`. Hibernate must validate the schema in production and must not create, update, or drop schema objects.

Reasons:

- Hibernate `ddl-auto=update` can silently mutate production schema.
- Existing production history includes manual schema repair and potential drift.
- Flyway gives ordered, reviewable, repeatable schema changes before tombstone work.

Consequences:

- Production uses `application-prod.yml`.
- `ProductionDatabaseSafetyGuard` fails startup on unsafe effective production values.
- `database/schema.sql` remains documentation/reference only.
- Existing databases need backup, schema export, and a deliberate Flyway baseline strategy before steady-state migration rollout.

## ADR-002: Keep Local H2 Fast Path Separate

Status: Accepted

The default profile keeps H2 and Hibernate `update` for local quick startup. Production safety is enforced only when `prod` or `production` is active.

Reasons:

- Current developer workflow depends on zero-setup local backend startup.
- PostgreSQL-specific migrations should not break quick H2 tests.
- Production and local behavior must be explicit and documented.

## ADR-003: Keep Local-First Product Architecture

Status: Accepted

The frontend remains local-first. Local vocabulary operations continue to work
without authentication, and authenticated cloud sync acts as backup and
cross-device reconciliation rather than as a hard online dependency.

Reasons:

- This is core product behavior.
- Offline learning and local import/export remain valuable.
- A framework or online-first rewrite would create large regression risk.

Consequences:

- Frontend keeps local fallback stats for offline use.
- Backend remains authoritative for official cloud XP, achievements, stats,
  review schedule, revisions, and tombstones after authentication.

## ADR-004: Keep OAuth2 Session Auth And Enable CSRF

Status: Accepted

The backend keeps Google OAuth2 with Spring Security session cookies. CSRF is
enabled through `XSRF-TOKEN` cookie plus `X-XSRF-TOKEN` header for unsafe
requests.

Reasons:

- The existing product is browser/session based.
- JWT would not remove CSRF risk by itself and would add auth migration risk.
- Spring Security supports the chosen SPA CSRF pattern.

## ADR-005: Server-Authoritative Progress

Status: Accepted

Official XP, level, achievements, quiz history, word stats, mastery, wrong bank,
review schedule, sync revision, ownership, timestamps, and tombstones are
server-authoritative.

Reasons:

- Client payloads can be forged.
- Derived learning state must be consistent across devices.
- Tests can now prove forged quiz/sync payloads do not mint official progress.

## ADR-006: Sync Contract V2 Uses Stable UUID Identity And Tombstones

Decision: keep numeric `vocabulary.id` as the database primary key, add `vocabulary.word_uid UUID` as the logical sync identity, and store deletes in `word_tombstones` rather than soft-deleting vocabulary rows.

Rationale:

- Numeric IDs are not stable for offline-created words or cross-device sync.
- English text can change and must not be the Sync V2 identity.
- Tombstones allow stale devices to learn that a word was deleted even after the live row has been hard-deleted.

Rejected for this increment: CRDTs, vector clocks, event sourcing, tombstone garbage collection, and per-field merge. The product currently needs a single server-authoritative revision with pessimistic locking, not a distributed conflict-resolution system.

## ADR-007: Incremental Frontend Modularization

Status: Accepted

Frontend hardening proceeds through small extractions such as the shared API
client and sync helpers. The app is not being rewritten into React, Vue, or a
bundled framework in this hardening pass.

Reasons:

- Existing Playwright coverage protects the static app behavior.
- A framework rewrite would obscure security/sync hardening risk.
- Incremental changes keep local-first fallback easier to verify.

## ADR-008: In-Memory Rate Limit Until Scale Evidence Changes

Status: Accepted

The AI rate limiter remains configurable and in-memory. It is not described as
distributed.

Reasons:

- Repository/deployment docs show one backend web service.
- No Redis/shared counter dependency exists.
- No multi-instance deployment or concrete abuse/cost incident is evidenced.

Upgrade trigger: add Redis or another distributed limiter when the backend runs
multiple instances, AI usage creates material cost exposure, or abuse evidence
appears.
