# Documentation Index

Last refreshed: 2026-08-08

This repository uses source code as the final authority. Older audit and
handover files are kept for history, but current decisions should start here.

## Read First

1. [Project overview](../README.md) - quick start, stack, and deployment entry points.
2. [Architecture](ARCHITECTURE.md) - backend packages, Sync V2, observability flow.
3. [Domain](DOMAIN.md) - business invariants for quiz, XP, stats, sync, and tombstones.
4. [API notes](API.md) - CSRF, logout, Sync V2, and direct CRUD behavior.
5. [Current technical audit](technical-audit-report.md) - reconciled findings and production readiness.
6. [Quality upgrade plan to 8.0](quality-upgrade-plan-8.0.md) - prioritized action plan from current quality to the 8.0 target.
7. [Roadmap](ROADMAP.md) - release blockers, near-term work, and refactor candidates.

## Operations

- [Deployment runbook](DEPLOYMENT.md)
- [Detailed deploy guide](deploy.md)
- [Production release gate](PRODUCTION_RELEASE_GATE.md)
- [Restore rehearsal checklist](restore-rehearsal-checklist.md)
- [Testing guide](TESTING.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Security And Data

- [Security notes](SECURITY.md)
- [Database guide](DATABASE.md)
- [Backend/PostgreSQL guide](backend-postgres.md)
- [Google OAuth setup](oauth-google.md)
- [Integrations](INTEGRATIONS.md)
- [Architecture decisions](DECISIONS.md)

## Current Topic Notes

- [Production hardening status](production-hardening-status.md)
- [Sync hardening audit](sync-hardening-audit.md)
- [Project handover index](project-handover-spec.md)
- [Production schema drift audit](production-schema-drift-audit.md)
- [Schema audit](schema-audit.md)
- [Flyway baseline strategy](flyway-baseline-strategy.md)
- [Flyway baseline rehearsal](flyway-baseline-rehearsal.md)
- [Frontend notes](FRONTEND.md)
- [Product notes](product.md)

## Historical Material

Historical docs and duplicate audit inputs live in [archive](archive/). They are
useful for context, but they may describe pre-hardening behavior such as disabled
CSRF, no tombstone contract, client-trusted XP, or unsafe production schema
defaults. The current source and [current technical audit](technical-audit-report.md)
supersede those conclusions.
