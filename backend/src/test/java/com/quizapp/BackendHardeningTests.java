package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class BackendHardeningTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    @Test
    void invalidWordRequestReturnsUnifiedValidationError() throws Exception {
        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser("validation@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "eng": "",
                                  "vie": "",
                                  "pos": "n"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Validation failed.")))
                .andExpect(jsonPath("$.errors", hasItem(containsString("eng:"))))
                .andExpect(jsonPath("$.errors", hasItem(containsString("vie:"))));
    }

    @Test
    void createWordRejectsNormalizedEnglishDuplicate() throws Exception {
        String email = "duplicate-create@example.com";

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", " Hello   World ",
                                "vie", "xin chao the gioi",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("Hello World")));

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "hello world",
                                "vie", "xin chao",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Word already exists.")));

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)));
    }

    @Test
    void updateWordRejectsNormalizedEnglishDuplicateButAllowsSameWord() throws Exception {
        String email = "duplicate-update@example.com";
        long helloId = createWord(email, "Hello", "xin chao");
        long focusId = createWord(email, "focus", "tap trung");

        mockMvc.perform(put("/api/vocab/" + helloId)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", " hello ",
                                "vie", "xin chao updated",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("hello")))
                .andExpect(jsonPath("$.vie", is("xin chao updated")));

        mockMvc.perform(put("/api/vocab/" + focusId)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", " HELLO ",
                                "vie", "xin chao duplicate",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Word already exists.")));
    }

    @Test
    void regularUserCannotImportAdminSampleWords() throws Exception {
        mockMvc.perform(post("/api/admin/sample-words")
                        .with(oauthUser("regular-user@example.com")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Forbidden.")))
                .andExpect(jsonPath("$.errors[0]", is("Admin role is required.")));
    }

    @Test
    void currentUserEndpointReturnsUnauthenticatedJsonWithoutRedirect() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated", is(false)));
    }

    @Test
    void vocabularyCrudStillWorksForAuthenticatedUser() throws Exception {
        String email = "crud-user@example.com";

        MvcResult createResult = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "focus",
                                "vie", "tap trung",
                                "pos", "v",
                                "tag", "study"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("focus")))
                .andExpect(jsonPath("$.vie", is("tap trung")))
                .andReturn();

        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());
        long id = created.get("id").asLong();

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id", is((int) id)))
                .andExpect(jsonPath("$[0].eng", is("focus")));

        mockMvc.perform(put("/api/vocab/" + id)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "focus",
                                "vie", "tap trung cao do",
                                "pos", "v",
                                "tag", "study"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vie", is("tap trung cao do")));

        mockMvc.perform(delete("/api/vocab/" + id)
                        .with(oauthUser(email)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(0)));
    }

    @Test
    void deleteVocabularyIsIdempotentAndDoesNotCrossUserBoundaries() throws Exception {
        String ownerEmail = "delete-owner@example.com";
        String otherEmail = "delete-other@example.com";
        long ownerWordId = createWord(ownerEmail, "archive", "luu tru");
        long otherWordId = createWord(otherEmail, "private", "rieng tu");

        mockMvc.perform(delete("/api/vocab/" + ownerWordId)
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/vocab/" + ownerWordId)
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/vocab/99999999")
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/vocab/" + otherWordId)
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(0)));

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(otherEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)))
                .andExpect(jsonPath("$[0].id", is((int) otherWordId)))
                .andExpect(jsonPath("$[0].eng", is("private")));
    }

    @Test
    void snapshotIncludesCurrentSyncRevision() throws Exception {
        mockMvc.perform(get("/api/snapshot")
                        .with(oauthUser("revision-snapshot@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(0)));
    }

    @Test
    void syncWithMatchingRevisionSucceedsAndIncrementsRevision() throws Exception {
        String email = "revision-success@example.com";

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "expectedRevision": 0,
                                  "vocab": [
                                    {
                                      "eng": "revision word",
                                      "vie": "tu phien ban",
                                      "pos": "n"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)))
                .andExpect(jsonPath("$.vocab[0].eng", is("revision word")));
    }

    @Test
    void staleSyncRevisionReturnsConflictAndDoesNotMutate() throws Exception {
        String email = "revision-conflict@example.com";

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "expectedRevision": 0,
                                  "vocab": [
                                    {
                                      "eng": "first revision word",
                                      "vie": "tu dau",
                                      "pos": "n"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)));

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "expectedRevision": 0,
                                  "vocab": [
                                    {
                                      "eng": "stale overwrite",
                                      "vie": "ghi de cu",
                                      "pos": "n"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("SYNC_REVISION_CONFLICT")))
                .andExpect(jsonPath("$.currentRevision", is(1)));

        mockMvc.perform(get("/api/snapshot")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)))
                .andExpect(jsonPath("$.vocab[0].eng", is("first revision word")));
    }

    @Test
    void missingSyncRevisionIsRejectedWithoutMutation() throws Exception {
        String email = "revision-missing@example.com";

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "vocab": [
                                    {
                                      "eng": "missing revision word",
                                      "vie": "thieu phien ban",
                                      "pos": "n"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("SYNC_REVISION_CONFLICT")))
                .andExpect(jsonPath("$.currentRevision", is(0)));

        mockMvc.perform(get("/api/snapshot")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(0)))
                .andExpect(jsonPath("$.vocab.length()", is(0)));
    }

    @Test
    void concurrentSyncWithSameRevisionAllowsOnlyOneWriter() throws Exception {
        String email = "revision-concurrent@example.com";
        mockMvc.perform(get("/api/snapshot")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(0)));

        var executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> first = () -> postSyncStatus(email, "concurrent one", "mot");
            Callable<Integer> second = () -> postSyncStatus(email, "concurrent two", "hai");

            var results = executor.invokeAll(List.of(first, second), 10, TimeUnit.SECONDS).stream()
                    .map(future -> {
                        try {
                            return future.get();
                        } catch (Exception exception) {
                            throw new RuntimeException(exception);
                        }
                    })
                    .sorted()
                    .toList();

            org.assertj.core.api.Assertions.assertThat(results).containsExactly(200, 409);
        } finally {
            executor.shutdownNow();
        }

        mockMvc.perform(get("/api/snapshot")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)));
    }

    @Test
    void snapshotHandlesLegacyNullVocabularyFlags() throws Exception {
        createWord("legacy-null-flags@example.com", "legacy", "cu");

        try (var connection = dataSource.getConnection();
             var statement = connection.createStatement()) {
            statement.executeUpdate("ALTER TABLE vocabulary ALTER COLUMN favorite DROP NOT NULL");
            statement.executeUpdate("ALTER TABLE vocabulary ALTER COLUMN mastered DROP NOT NULL");
            statement.executeUpdate("UPDATE vocabulary SET favorite = NULL, mastered = NULL WHERE eng = 'legacy'");
        }

        mockMvc.perform(get("/api/snapshot")
                        .with(oauthUser("legacy-null-flags@example.com")))
                .andExpect(status().isOk());
    }

    @Test
    void authenticatedReadEndpointsHandleLegacyNullMetrics() throws Exception {
        String email = "legacy-null-metrics@example.com";
        createWord(email, "legacy metrics", "chi so cu");

        mockMvc.perform(post("/api/quiz-results")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quizMode": "mixed",
                                  "challengeSeconds": 30,
                                  "totalQuestions": 1,
                                  "correctAnswers": 0,
                                  "wrongAnswers": 1,
                                  "score": 0,
                                  "maxCombo": 0,
                                  "answers": [
                                    {
                                      "eng": "legacy metrics",
                                      "questionMode": "mixed",
                                      "selectedAnswer": "wrong",
                                      "correctAnswer": "chi so cu",
                                      "correct": false
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        try (var connection = dataSource.getConnection();
             var statement = connection.createStatement()) {
            dropNotNull(statement, "app_users", "xp", "level", "streak", "best_streak");
            dropNotNull(statement, "vocabulary", "favorite", "mastered");
            dropNotNull(statement, "word_stats", "seen", "correct", "wrong", "current_streak", "best_streak", "mastery_level");
            dropNotNull(statement, "wrong_bank", "mastered");
            dropNotNull(statement, "quiz_history", "total_questions", "correct_answers", "wrong_answers", "score", "max_combo", "created_at");
            dropNotNull(statement, "achievements", "xp_reward");

            statement.executeUpdate("""
                    UPDATE app_users
                    SET xp = NULL, level = NULL, streak = NULL, best_streak = NULL
                    WHERE email = 'legacy-null-metrics@example.com'
                    """);
            statement.executeUpdate("""
                    UPDATE vocabulary
                    SET favorite = NULL, mastered = NULL
                    WHERE eng = 'legacy metrics'
                    """);
            statement.executeUpdate("""
                    UPDATE word_stats
                    SET seen = NULL,
                        correct = NULL,
                        wrong = NULL,
                        current_streak = NULL,
                        best_streak = NULL,
                        mastery_level = NULL,
                        next_review = TIMESTAMP '2020-01-01 00:00:00'
                    """);
            statement.executeUpdate("UPDATE wrong_bank SET mastered = NULL");
            statement.executeUpdate("""
                    UPDATE quiz_history
                    SET total_questions = NULL,
                        correct_answers = NULL,
                        wrong_answers = NULL,
                        score = NULL,
                        max_combo = NULL,
                        created_at = NULL
                    """);
            statement.executeUpdate("UPDATE achievements SET xp_reward = NULL");
        }

        for (String path : List.of(
                "/api/me",
                "/api/snapshot",
                "/api/review/queue?limit=8",
                "/api/analytics/overview",
                "/api/analytics/review-pressure",
                "/api/analytics/weak-words",
                "/api/analytics/accuracy-trend",
                "/api/analytics/tag-performance"
        )) {
            mockMvc.perform(get(path).with(oauthUser(email)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void syncSkipsMalformedItemsAndClampsUnsafeStats() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/sync")
                        .with(oauthUser("sync-clamp@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "expectedRevision": 0,
                                  "vocab": [
                                    {
                                      "eng": "",
                                      "vie": "bad"
                                    },
                                    {
                                      "eng": "safe stats",
                                      "vie": "thong ke an toan",
                                      "pos": "n",
                                      "stats": {
                                        "seen": -5,
                                        "correct": -2,
                                        "wrong": 2000001,
                                        "streak": -7,
                                        "bestStreak": -1,
                                        "masteryLevel": 99,
                                        "lastReviewed": "2999-01-01T00:00:00Z",
                                        "nextReview": "2999-01-01T00:00:00Z"
                                      }
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)))
                .andExpect(jsonPath("$.vocab[0].eng", is("safe stats")))
                .andReturn();

        JsonNode stats = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("vocab").get(0).get("stats");
        org.assertj.core.api.Assertions.assertThat(stats.get("seen").asInt()).isZero();
        org.assertj.core.api.Assertions.assertThat(stats.get("correct").asInt()).isZero();
        org.assertj.core.api.Assertions.assertThat(stats.get("wrong").asInt()).isEqualTo(1_000_000);
        org.assertj.core.api.Assertions.assertThat(stats.get("streak").asInt()).isZero();
        org.assertj.core.api.Assertions.assertThat(stats.get("bestStreak").asInt()).isZero();
        org.assertj.core.api.Assertions.assertThat(stats.get("masteryLevel").asInt()).isEqualTo(5);
        org.assertj.core.api.Assertions.assertThat(stats.path("lastReviewed").isMissingNode()
                || stats.path("lastReviewed").isNull()).isTrue();
        org.assertj.core.api.Assertions.assertThat(stats.path("nextReview").isMissingNode()
                || stats.path("nextReview").isNull()).isTrue();
    }

    @Test
    void quizResultRequestClampsNonFiniteAndImpossibleNumbers() {
        com.quizapp.vocab.QuizResultRequest nanRequest = new com.quizapp.vocab.QuizResultRequest(
                "mixed",
                -5,
                -3,
                8,
                4,
                Double.NaN,
                999,
                List.of()
        );
        com.quizapp.vocab.QuizResultRequest infiniteRequest = new com.quizapp.vocab.QuizResultRequest(
                "mixed",
                200_000,
                999,
                999,
                999,
                Double.POSITIVE_INFINITY,
                999,
                List.of(new com.quizapp.vocab.QuizAnswerRequest("focus", "mixed", "wrong", "tap trung", false))
        );

        org.assertj.core.api.Assertions.assertThat(nanRequest.challengeSeconds()).isZero();
        org.assertj.core.api.Assertions.assertThat(nanRequest.totalQuestions()).isZero();
        org.assertj.core.api.Assertions.assertThat(nanRequest.correctAnswers()).isZero();
        org.assertj.core.api.Assertions.assertThat(nanRequest.wrongAnswers()).isZero();
        org.assertj.core.api.Assertions.assertThat(nanRequest.score()).isZero();
        org.assertj.core.api.Assertions.assertThat(nanRequest.maxCombo()).isZero();

        org.assertj.core.api.Assertions.assertThat(infiniteRequest.challengeSeconds()).isEqualTo(86_400);
        org.assertj.core.api.Assertions.assertThat(infiniteRequest.totalQuestions()).isEqualTo(500);
        org.assertj.core.api.Assertions.assertThat(infiniteRequest.correctAnswers()).isEqualTo(500);
        org.assertj.core.api.Assertions.assertThat(infiniteRequest.wrongAnswers()).isEqualTo(500);
        org.assertj.core.api.Assertions.assertThat(infiniteRequest.score()).isZero();
        org.assertj.core.api.Assertions.assertThat(infiniteRequest.maxCombo()).isEqualTo(500);
    }

    @Test
    void malformedJsonAndTimestampsReturnBadRequestInsteadOfServerError() throws Exception {
        mockMvc.perform(post("/api/quiz-results")
                        .with(oauthUser("malformed-json@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quizMode\":\"mixed\",\"score\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Malformed request body.")));

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("malformed-time@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "vocab": [
                                    {
                                      "eng": "bad timestamp",
                                      "vie": "loi thoi gian",
                                      "stats": {
                                        "seen": 1,
                                        "correct": 1,
                                        "wrong": 0,
                                        "streak": 1,
                                        "bestStreak": 1,
                                        "masteryLevel": 1,
                                        "lastReviewed": "not-a-date"
                                      }
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Malformed request body.")));
    }

    @Test
    void analyticsEndpointsHandleEmptyAndCorruptedStatsWithoutServerError() throws Exception {
        String email = "analytics-clamp@example.com";
        createWord(email, "corrupted stats", "chi so loi");

        try (var connection = dataSource.getConnection();
             var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE word_stats
                    SET seen = -10,
                        correct = 5000000,
                        wrong = -20,
                        current_streak = -5,
                        best_streak = -1,
                        mastery_level = 99,
                        next_review = TIMESTAMP '2020-01-01 00:00:00'
                    """);
        }

        for (String path : List.of(
                "/api/analytics/overview",
                "/api/analytics/review-pressure",
                "/api/analytics/weak-words",
                "/api/analytics/accuracy-trend",
                "/api/review/queue?limit=8"
        )) {
            mockMvc.perform(get(path).with(oauthUser(email)))
                    .andExpect(status().isOk());
        }

        MvcResult overview = mockMvc.perform(get("/api/analytics/overview")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode averageAccuracy = objectMapper.readTree(overview.getResponse().getContentAsString())
                .path("averageAccuracy");
        org.assertj.core.api.Assertions.assertThat(averageAccuracy.asInt()).isBetween(0, 100);
    }

    private void dropNotNull(java.sql.Statement statement, String table, String... columns) throws Exception {
        for (String column : columns) {
            statement.executeUpdate("ALTER TABLE " + table + " ALTER COLUMN " + column + " DROP NOT NULL");
        }
    }

    private long createWord(String email, String eng, String vie) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", eng,
                                "vie", vie,
                                "pos", "n",
                                "tag", "test"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        return created.get("id").asLong();
    }

    private int postSyncStatus(String email, String eng, String vie) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expectedRevision", 0,
                                "vocab", List.of(Map.of(
                                        "eng", eng,
                                        "vie", vie,
                                        "pos", "n"
                                ))
                        ))))
                .andReturn();
        return result.getResponse().getStatus();
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor oauthUser(String email) {
        return oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Test User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
    }
}
