package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class DatabaseSchemaTests {
    @Test
    void retentionV8AddsOnlyPortableCleanupIndexesAndMatchesReferenceSchema() throws Exception {
        String migration = Files.readString(Path.of(
                "src/main/resources/db/migration/V8__add_retention_cleanup_indexes.sql"));
        String schema = Files.readString(Path.of("../database/schema.sql"));
        String normalizedSchema = schema.replace("CREATE INDEX IF NOT EXISTS", "CREATE INDEX")
                .replace("\r\n", "\n");
        assertThat(normalizedSchema).contains(migration.replace("\r\n", "\n").trim());
        assertThat(migration).contains("ON learning_attempt(status, consumed_at, id)");
        assertThat(migration).contains("ON learning_attempt(status, expires_at, id)");
        assertThat(migration).contains("ON review_operation(consumed_at, id)");
        assertThat(migration.toLowerCase()).doesNotContain("where status");
        assertThat(migration.toLowerCase()).doesNotContain("delete from");
        assertThat(migration.toLowerCase()).doesNotContain("drop ");

        try (var connection = java.sql.DriverManager.getConnection(
                "jdbc:h2:mem:retentionV8;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE learning_attempt (id UUID PRIMARY KEY, status VARCHAR(20), "
                    + "consumed_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE)");
            statement.execute("CREATE TABLE review_operation (id UUID PRIMARY KEY, "
                    + "consumed_at TIMESTAMP WITH TIME ZONE)");
            statement.execute(migration);
            try (var rows = statement.executeQuery("""
                    SELECT COUNT(*) FROM information_schema.indexes
                    WHERE index_name IN ('ix_learning_attempt_retention_consumed',
                        'ix_learning_attempt_retention_expired', 'ix_review_operation_retention_consumed')
                    """)) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isEqualTo(3);
            }
        }
    }

    @Test
    void reviewOperationV7RunsOnH2AndMatchesReferenceSchema() throws Exception {
        String migration = Files.readString(Path.of("src/main/resources/db/migration/V7__add_review_operations.sql"));
        String schema = Files.readString(Path.of("../database/schema.sql"));
        String v7Ddl = migration.replace(
                "-- Physical retention cleanup is deferred to Finding 12's lifecycle batch.", "").trim();
        assertThat(schema.replace("CREATE TABLE IF NOT EXISTS", "CREATE TABLE")
                .replace("CREATE INDEX IF NOT EXISTS", "CREATE INDEX").replace("\r\n", "\n"))
                .contains(v7Ddl.replace("\r\n", "\n"));
        try (var connection = java.sql.DriverManager.getConnection("jdbc:h2:mem:reviewV7;MODE=PostgreSQL", "sa", "");
             var statement = connection.createStatement()) {
            statement.execute("CREATE DOMAIN TIMESTAMPTZ AS TIMESTAMP WITH TIME ZONE");
            statement.execute("CREATE TABLE app_users (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE vocabulary (id BIGINT PRIMARY KEY, user_id BIGINT, UNIQUE(id, user_id))");
            statement.execute(migration);
            statement.execute("INSERT INTO app_users VALUES (1), (2)");
            statement.execute("INSERT INTO vocabulary VALUES (10, 1), (20, 2)");
            String insert = "INSERT INTO review_operation (id,user_id,word_id,target_word_id,target_user_id,action,"
                    + "fingerprint,created_at,consumed_at,mastery,streak,next_review,message,resulting_revision) VALUES "
                    + "('00000000-0000-4000-8000-000000000001',1,10,10,1,'review','" + "a".repeat(64)
                    + "',NOW(),NOW(),20,1,DATEADD('DAY',1,NOW()),'accepted',1)";
            statement.execute(insert);
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.execute(insert))
                    .isInstanceOf(java.sql.SQLException.class); // unique identity
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.execute(
                    "UPDATE review_operation SET target_user_id = 2"))
                    .isInstanceOf(java.sql.SQLException.class); // cross-owner binding
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.execute(
                    "UPDATE review_operation SET consumed_at = NULL"))
                    .isInstanceOf(java.sql.SQLException.class); // no partial outcome
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.execute(
                    "UPDATE review_operation SET action = 'arbitrary'"))
                    .isInstanceOf(java.sql.SQLException.class);
            statement.execute("DELETE FROM vocabulary WHERE id = 10");
            try (var rows = statement.executeQuery("SELECT word_id, target_word_id, target_user_id FROM review_operation")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong(1)).isEqualTo(10);
                assertThat(rows.getObject(2)).isNull();
                assertThat(rows.getObject(3)).isNull();
            }
            statement.execute("DELETE FROM app_users WHERE id = 1");
            try (var rows = statement.executeQuery("SELECT COUNT(*) FROM review_operation")) {
                rows.next(); assertThat(rows.getInt(1)).isZero();
            }
        }
    }

    @Test
    void schemaIncludesAdditiveColumnsNeededByCloudReviewEndpoints() throws Exception {
        String schema = Files.readString(Path.of("..", "database", "schema.sql")).toLowerCase();

        assertThat(schema).contains("alter table app_users add column if not exists last_active_date");
        assertThat(schema).contains("alter table vocabulary add column if not exists created_at");
        assertThat(schema).contains("alter table vocabulary add column if not exists updated_at");
        assertThat(schema).contains("alter table word_stats add column if not exists next_review");
        assertThat(schema).contains("alter table word_stats add column if not exists current_streak");
        assertThat(schema).contains("alter table app_users add column if not exists sync_revision bigint not null default 0");
    }

    @Test
    void flywayMigrationAddsSyncRevisionAdditively() throws Exception {
        String migration = Files.readString(Path.of(
                "src", "main", "resources", "db", "migration", "V2__add_sync_revision.sql"
        )).toLowerCase();

        assertThat(migration).contains("alter table app_users");
        assertThat(migration).contains("add column if not exists sync_revision bigint not null default 0");
        assertThat(migration).doesNotContain("drop table");
        assertThat(migration).doesNotContain("delete from");
        assertThat(migration).doesNotContain("truncate");
    }

    @Test
    void quizAttemptMigrationEnforcesOwnershipUniquenessAndBoundedOutcomeStorage() throws Exception {
        String migration = Files.readString(Path.of(
                "src", "main", "resources", "db", "migration", "V5__add_quiz_attempts.sql"
        )).toLowerCase();
        String schema = Files.readString(Path.of("..", "database", "schema.sql")).toLowerCase();

        assertThat(migration).contains("create table learning_attempt");
        assertThat(migration).contains("create table learning_attempt_item");
        assertThat(migration).contains("unique (attempt_id, ordinal)");
        assertThat(migration).contains("unique (attempt_id, word_id)");
        assertThat(migration).contains("references learning_attempt(id, user_id)");
        assertThat(migration).contains("references vocabulary(id, user_id)");
        assertThat(migration).contains("submission_fingerprint varchar(64)");
        assertThat(migration).contains("char_length(submission_fingerprint) = 64");
        assertThat(migration).contains("quiz_history_id is not null");
        assertThat(migration).contains("consumed_at >= created_at");
        assertThat(migration).contains("consumed_at < expires_at");
        assertThat(migration).doesNotContain(
                "foreign key (quiz_history_id) references quiz_history(id) on delete set null"
        );
        assertThat(migration).doesNotContain("json");
        assertThat(migration).doesNotContain("drop table");
        assertThat(migration).doesNotContain("delete from");
        assertThat(schema).contains("create table if not exists learning_attempt");
        assertThat(schema).contains("create table if not exists learning_attempt_item");
    }

    @Test
    void quizAttemptAchievementXpMigrationKeepsReplayOutcomeImmutable() throws Exception {
        String migration = Files.readString(Path.of(
                "src", "main", "resources", "db", "migration", "V6__capture_quiz_attempt_achievement_xp.sql"
        )).toLowerCase();
        String schema = Files.readString(Path.of("..", "database", "schema.sql")).toLowerCase();

        assertThat(migration).contains("add column awarded_achievement_xp integer");
        assertThat(migration).contains("status = 'issued' and awarded_achievement_xp is null");
        assertThat(migration).contains("status = 'consumed' and awarded_achievement_xp is not null");
        assertThat(migration).doesNotContain("drop table");
        assertThat(migration).doesNotContain("truncate");
        assertThat(schema).contains("awarded_achievement_xp integer");
        assertThat(schema).contains("awarded_achievement_xp >= 0");
    }
}
