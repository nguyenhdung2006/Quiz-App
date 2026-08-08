# Project Handover

Last refreshed: 2026-08-08

The original handover document was longer than 1000 lines and contains some
pre-hardening statements. It was split into topic files under `docs/archive/`.
The split files preserve the original content for reconstruction and historical
review; they are not current operational guidance.

## Current Recommended Reading

- `docs/README.md` for the project documentation map.
- `docs/ARCHITECTURE.md` for active architecture.
- `docs/DOMAIN.md` for source-aligned business invariants.
- `docs/API.md` for active API contracts.
- `docs/technical-audit-report.md` for current audit findings.

## Historical Split Handover Files

- `docs/archive/project-handover-spec/overview-architecture.md`
- `docs/archive/project-handover-spec/database-model.md`
- `docs/archive/project-handover-spec/api-business-logic.md`
- `docs/archive/project-handover-spec/frontend-flows.md`
- `docs/archive/project-handover-spec/diagrams-config-ops.md`

## Important Current Corrections

Some original handover sections described older sync and release behavior. For
the current source:

- Sync is V2 with `wordUid`, `expectedRevision`, `deletions`, and tombstones.
- CSRF is enabled for unsafe session-auth API requests.
- Production profile uses Flyway plus Hibernate `ddl-auto=validate`.
- Official XP, achievements, stats, review schedule, history, and tombstones are
  server-authoritative.
- The app is hardened beyond the old audit baseline, but it is not yet
  production-ready until the current blockers are verified and closed.
