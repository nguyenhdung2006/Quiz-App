# Known Issues

- Production `flyway_schema_history` cannot be verified from this workspace because no production database connection is available.
- Existing production/staging databases must be backed up, exported, and compared against Flyway V1/V2 before enabling steady-state migrations.
- `database/schema.sql` is a legacy reference/repair script and is not equivalent to the Flyway migration history.
- No tombstone migration has been added yet; future tombstone work must start at the next Flyway version after V2.
# 2026-07-31 Sync V2 Known Limitations

- No local PostgreSQL CLI/staging database rehearsal was executed in this workspace; CI coverage was added instead.
- Tombstone garbage collection is intentionally not implemented.
- Frontend English-based merge remains only as a legacy adoption fallback for local/generated UIDs.
