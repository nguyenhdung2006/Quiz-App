# Known Issues

- Production `flyway_schema_history` cannot be verified from this workspace because no production database connection is available.
- Existing production/staging databases must be backed up, exported, and compared against Flyway V1/V2 before enabling steady-state migrations.
- `database/schema.sql` is a legacy reference/repair script and is not equivalent to the Flyway migration history.
- No tombstone migration has been added yet; future tombstone work must start at the next Flyway version after V2.
