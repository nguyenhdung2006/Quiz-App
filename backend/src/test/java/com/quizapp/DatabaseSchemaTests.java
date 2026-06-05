package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class DatabaseSchemaTests {
    @Test
    void schemaIncludesAdditiveColumnsNeededByCloudReviewEndpoints() throws Exception {
        String schema = Files.readString(Path.of("..", "database", "schema.sql")).toLowerCase();

        assertThat(schema).contains("alter table app_users add column if not exists last_active_date");
        assertThat(schema).contains("alter table vocabulary add column if not exists created_at");
        assertThat(schema).contains("alter table vocabulary add column if not exists updated_at");
        assertThat(schema).contains("alter table word_stats add column if not exists next_review");
        assertThat(schema).contains("alter table word_stats add column if not exists current_streak");
    }
}
