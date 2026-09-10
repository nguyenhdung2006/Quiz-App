package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.retention.LearningRetentionCleanupResult;
import com.quizapp.retention.LearningRetentionCleanupService;
import com.quizapp.retention.LearningRetentionClock;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id", "GOOGLE_CLIENT_SECRET=test-client-secret",
        "spring.datasource.url=jdbc:h2:mem:finding12retention;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.retention.cleanup-batch-size=3", "app.retention.cleanup-throttle=PT0S"
})
@AutoConfigureMockMvc
class Finding12RetentionCleanupTests {
    private static final Instant NOW = Instant.parse("2026-09-02T12:00:00Z");
    private static final Duration RETENTION = Duration.ofDays(7);

    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean LearningRetentionClock retentionClock;
    @MockitoSpyBean LearningRetentionCleanupService cleanup;

    @BeforeEach
    void resetDatabaseAndClock() {
        doCallRealMethod().when(cleanup).cleanupOnce();
        when(retentionClock.now()).thenReturn(NOW);
        for (String table : List.of("review_operation", "learning_attempt_item", "learning_attempt",
                "quiz_history_answers", "quiz_history", "wrong_bank", "word_stats", "vocabulary",
                "user_achievements", "app_users")) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    @Test
    void consumedAttemptsUseStrictSevenDayBoundaryCascadeItemsAndKeepHistory() {
        long userA = createUser("consumed-a"), userB = createUser("consumed-b");
        AttemptFixture inside = consumedAttempt(userA, NOW.minus(Duration.ofDays(6)).minus(Duration.ofHours(23))
                .minus(Duration.ofMinutes(59)));
        AttemptFixture boundary = consumedAttempt(userA, NOW.minus(RETENTION));
        AttemptFixture oldA = consumedAttempt(userA, NOW.minus(RETENTION).minusSeconds(1));
        AttemptFixture oldB = consumedAttempt(userB, NOW.minus(RETENTION).minus(Duration.ofDays(2)));

        LearningRetentionCleanupResult result = cleanup.cleanupOnce();

        assertThat(result.deletedConsumedAttempts()).isEqualTo(2);
        assertThat(attemptExists(inside.attemptId())).isTrue();
        assertThat(attemptExists(boundary.attemptId())).isTrue();
        assertThat(attemptExists(oldA.attemptId())).isFalse();
        assertThat(attemptExists(oldB.attemptId())).isFalse();
        assertThat(itemExists(oldA.attemptId())).isFalse();
        assertThat(itemExists(oldB.attemptId())).isFalse();
        assertThat(historyExists(oldA.historyId())).isTrue();
        assertThat(historyExists(oldB.historyId())).isTrue();
        assertThat(historyCount()).isEqualTo(4);
    }

    @Test
    void issuedAttemptsUseStrictSevenDayGraceAfterExpiry() {
        long user = createUser("issued");
        UUID unexpired = issuedAttempt(user, NOW.plusSeconds(1));
        UUID inside = issuedAttempt(user, NOW.minus(Duration.ofDays(6)).minus(Duration.ofHours(23))
                .minus(Duration.ofMinutes(59)));
        UUID boundary = issuedAttempt(user, NOW.minus(RETENTION));
        UUID old = issuedAttempt(user, NOW.minus(RETENTION).minusSeconds(1));

        LearningRetentionCleanupResult result = cleanup.cleanupOnce();

        assertThat(result.deletedExpiredIssuedAttempts()).isEqualTo(1);
        assertThat(attemptExists(unexpired)).isTrue();
        assertThat(attemptExists(inside)).isTrue();
        assertThat(attemptExists(boundary)).isTrue();
        assertThat(attemptExists(old)).isFalse();
        assertThat(itemExists(old)).isFalse();
    }

    @Test
    void reviewOperationsUseStrictSevenDayBoundaryAcrossOwners() {
        long userA = createUser("review-a"), userB = createUser("review-b");
        UUID inside = reviewOperation(userA, NOW.minus(Duration.ofDays(6)).minus(Duration.ofHours(23))
                .minus(Duration.ofMinutes(59)));
        UUID boundary = reviewOperation(userA, NOW.minus(RETENTION));
        UUID oldA = reviewOperation(userA, NOW.minus(RETENTION).minusSeconds(1));
        UUID oldB = reviewOperation(userB, NOW.minus(RETENTION).minus(Duration.ofDays(2)));

        LearningRetentionCleanupResult result = cleanup.cleanupOnce();

        assertThat(result.deletedReviewOperations()).isEqualTo(2);
        assertThat(reviewOperationExists(inside)).isTrue();
        assertThat(reviewOperationExists(boundary)).isTrue();
        assertThat(reviewOperationExists(oldA)).isFalse();
        assertThat(reviewOperationExists(oldB)).isFalse();
    }

    @Test
    void eachCategoryIsBoundedAndOldestRowsAreDeletedFirst() {
        long user = createUser("batch");
        List<UUID> consumed = new ArrayList<>(), issued = new ArrayList<>(), reviews = new ArrayList<>();
        for (int day = 20; day >= 16; day--) {
            consumed.add(consumedAttempt(user, NOW.minus(Duration.ofDays(day))).attemptId());
            issued.add(issuedAttempt(user, NOW.minus(Duration.ofDays(day))));
            reviews.add(reviewOperation(user, NOW.minus(Duration.ofDays(day))));
        }

        LearningRetentionCleanupResult first = cleanup.cleanupOnce();
        assertThat(first.selectedConsumedAttempts()).isEqualTo(3);
        assertThat(first.deletedConsumedAttempts()).isEqualTo(3);
        assertThat(first.selectedExpiredIssuedAttempts()).isEqualTo(3);
        assertThat(first.deletedExpiredIssuedAttempts()).isEqualTo(3);
        assertThat(first.selectedReviewOperations()).isEqualTo(3);
        assertThat(first.deletedReviewOperations()).isEqualTo(3);
        assertThat(consumed.subList(0, 3)).allMatch(id -> !attemptExists(id));
        assertThat(issued.subList(0, 3)).allMatch(id -> !attemptExists(id));
        assertThat(reviews.subList(0, 3)).allMatch(id -> !reviewOperationExists(id));
        assertThat(consumed.subList(3, 5)).allMatch(this::attemptExists);
        assertThat(issued.subList(3, 5)).allMatch(this::attemptExists);
        assertThat(reviews.subList(3, 5)).allMatch(this::reviewOperationExists);

        LearningRetentionCleanupResult second = cleanup.cleanupOnce();
        assertThat(second.deletedConsumedAttempts()).isEqualTo(2);
        assertThat(second.deletedExpiredIssuedAttempts()).isEqualTo(2);
        assertThat(second.deletedReviewOperations()).isEqualTo(2);
        assertThat(consumed).noneMatch(this::attemptExists);
        assertThat(issued).noneMatch(this::attemptExists);
        assertThat(reviews).noneMatch(this::reviewOperationExists);
    }

    @Test
    void deletedConsumedAttemptCannotRecreateRewardsHistoryLearningOrRevision() throws Exception {
        String email = "deleted-attempt-" + UUID.randomUUID() + "@example.com";
        long wordId = createWord(email, "retained answer");
        MvcResult issued = mvc.perform(post("/api/quiz/attempts").with(auth(email))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "quizMode", "quiz", "items", List.of(Map.of("wordId", wordId, "questionMode", "eng"))))))
                .andExpect(status().isOk()).andReturn();
        UUID attemptId = UUID.fromString(body(issued).path("attemptId").asText());
        String answer = json.writeValueAsString(Map.of("answers",
                List.of(Map.of("ordinal", 0, "selectedAnswer", "meaning"))));
        mvc.perform(post("/api/quiz/attempts/{id}/submit", attemptId).with(auth(email))
                .contentType(MediaType.APPLICATION_JSON).content(answer)).andExpect(status().isOk());
        JsonNode accepted = snapshot(email);
        Instant consumed = NOW.minus(RETENTION).minusSeconds(1);
        jdbc.update("UPDATE learning_attempt SET created_at=?, expires_at=?, consumed_at=? WHERE id=?",
                timestamp(consumed.minus(Duration.ofHours(1))), timestamp(consumed.plus(Duration.ofHours(1))),
                timestamp(consumed), attemptId);
        cleanup.cleanupOnce();
        assertThat(attemptExists(attemptId)).isFalse();
        assertLearningStateUnchanged(accepted, snapshot(email));
        JsonNode before = snapshot(email);

        mvc.perform(post("/api/quiz/attempts/{id}/submit", attemptId).with(auth(email))
                .contentType(MediaType.APPLICATION_JSON).content(answer)).andExpect(status().isBadRequest());

        assertLearningStateUnchanged(before, snapshot(email));
    }

    @Test
    void deletedReviewLedgerStillCannotConsumeStaleDueState() throws Exception {
        String email = "deleted-review-" + UUID.randomUUID() + "@example.com";
        long wordId = createWord(email, "stale review");
        jdbc.update("UPDATE word_stats SET next_review=? WHERE word_id=?", timestamp(Instant.now().minusSeconds(60)), wordId);
        UUID operationId = UUID.randomUUID();
        String payload = json.writeValueAsString(Map.of("operationId", operationId, "wordId", wordId,
                "correct", true, "mode", "review"));
        mvc.perform(post("/api/review/answer").with(auth(email)).contentType(MediaType.APPLICATION_JSON)
                .content(payload)).andExpect(status().isOk());
        JsonNode accepted = snapshot(email);
        Instant consumed = NOW.minus(RETENTION).minusSeconds(1);
        jdbc.update("UPDATE review_operation SET created_at=?, consumed_at=? WHERE id=?",
                timestamp(consumed), timestamp(consumed), operationId);
        cleanup.cleanupOnce();
        assertThat(reviewOperationExists(operationId)).isFalse();
        assertLearningStateUnchanged(accepted, snapshot(email));
        JsonNode before = snapshot(email);

        mvc.perform(post("/api/review/answer").with(auth(email)).contentType(MediaType.APPLICATION_JSON)
                .content(payload)).andExpect(status().isConflict());

        assertLearningStateUnchanged(before, snapshot(email));
        assertThat(reviewOperationExists(operationId)).isFalse();
    }

    @Test
    void cleanupFailureAfterCommitCannotRollbackAcceptedReviewMutation() throws Exception {
        String email = "cleanup-failure-" + UUID.randomUUID() + "@example.com";
        long wordId = createWord(email, "maintenance isolation");
        doThrow(new IllegalStateException("simulated cleanup failure"))
                .doCallRealMethod().when(cleanup).cleanupOnce();
        UUID operationId = UUID.randomUUID();

        mvc.perform(post("/api/review/known").with(auth(email)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("operationId", operationId, "wordId", wordId))))
                .andExpect(status().isOk());

        JsonNode after = snapshot(email);
        assertThat(after.path("revision").asLong()).isEqualTo(2);
        assertThat(after.path("vocab").path(0).path("stats").path("seen").asInt()).isEqualTo(1);
        assertThat(reviewOperationExists(operationId)).isTrue();
    }

    @Test
    void cleanupCanRunAlongsideUnrelatedNormalReviewWithoutGlobalLocking() throws Exception {
        long maintenanceUser = createUser("concurrent-maintenance");
        reviewOperation(maintenanceUser, NOW.minus(Duration.ofDays(20)));
        String email = "concurrent-review-" + UUID.randomUUID() + "@example.com";
        long wordId = createWord(email, "normal review");
        UUID operationId = UUID.randomUUID();
        String payload = json.writeValueAsString(Map.of("operationId", operationId, "wordId", wordId));
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<Object>> calls = List.of(
                    () -> { ready.countDown(); start.await(5, TimeUnit.SECONDS); return cleanup.cleanupOnce(); },
                    () -> { ready.countDown(); start.await(5, TimeUnit.SECONDS); return mvc.perform(
                            post("/api/review/known").with(auth(email)).contentType(MediaType.APPLICATION_JSON)
                                    .content(payload)).andReturn(); });
            var futures = calls.stream().map(pool::submit).toList();
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(futures.get(0).get(15, TimeUnit.SECONDS)).isInstanceOf(LearningRetentionCleanupResult.class);
            assertThat(((MvcResult) futures.get(1).get(15, TimeUnit.SECONDS)).getResponse().getStatus()).isEqualTo(200);
        } finally {
            pool.shutdownNow();
        }
        assertThat(reviewOperationExists(operationId)).isTrue();
        assertThat(snapshot(email).path("vocab").path(0).path("stats").path("seen").asInt()).isEqualTo(1);
    }

    private AttemptFixture consumedAttempt(long userId, Instant consumedAt) {
        long historyId = createHistory(userId, consumedAt);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO learning_attempt
                (id,user_id,attempt_type,status,quiz_mode,created_at,expires_at,consumed_at,
                 submission_fingerprint,resulting_sync_revision,quiz_history_id,awarded_quiz_xp,
                 awarded_achievement_xp,result_total_questions,result_correct_answers,result_wrong_answers,
                 result_score,result_max_combo)
                VALUES (?,?, 'QUIZ','CONSUMED','quiz',?,?,?,?,?, ?,0,0,1,1,0,10,1)
                """, id, userId, timestamp(consumedAt.minus(Duration.ofHours(1))),
                timestamp(consumedAt.plus(Duration.ofHours(1))), timestamp(consumedAt), "a".repeat(64), 1L, historyId);
        insertAttemptItem(id, userId);
        return new AttemptFixture(id, historyId);
    }

    private UUID issuedAttempt(long userId, Instant expiresAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO learning_attempt
                (id,user_id,attempt_type,status,quiz_mode,created_at,expires_at)
                VALUES (?,?,'QUIZ','ISSUED','quiz',?,?)
                """, id, userId, timestamp(expiresAt.minus(Duration.ofHours(24))), timestamp(expiresAt));
        insertAttemptItem(id, userId);
        return id;
    }

    private void insertAttemptItem(UUID attemptId, long userId) {
        jdbc.update("""
                INSERT INTO learning_attempt_item
                (attempt_id,user_id,ordinal,question_mode,prompt,correct_answer)
                VALUES (?,?,0,'eng','prompt','answer')
                """, attemptId, userId);
    }

    private UUID reviewOperation(long userId, Instant consumedAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO review_operation
                (id,user_id,word_id,action,fingerprint,created_at,consumed_at,mastery,streak,
                 next_review,message,resulting_revision)
                VALUES (?,?,?,'known',?,?,?,20,1,?,'accepted',1)
                """, id, userId, Math.floorMod(id.getLeastSignificantBits(), 1_000_000L) + 1,
                "b".repeat(64), timestamp(consumedAt), timestamp(consumedAt),
                timestamp(consumedAt.plus(Duration.ofDays(1))));
        return id;
    }

    private long createUser(String prefix) {
        String email = prefix + "-" + UUID.randomUUID() + "@example.com";
        jdbc.update("""
                INSERT INTO app_users
                (email,google_subject,display_name,role,xp,level,streak,best_streak,sync_revision,created_at,updated_at)
                VALUES (?,?,?,'USER',0,1,0,0,0,?,?)
                """, email, "sub-" + email, prefix, timestamp(NOW), timestamp(NOW));
        return jdbc.queryForObject("SELECT id FROM app_users WHERE email=?", Long.class, email);
    }

    private long createHistory(long userId, Instant createdAt) {
        jdbc.update("""
                INSERT INTO quiz_history
                (user_id,total_questions,correct_answers,wrong_answers,score,quiz_mode,max_combo,created_at)
                VALUES (?,1,1,0,10,'quiz',1,?)
                """, userId, timestamp(createdAt));
        return jdbc.queryForObject("SELECT MAX(id) FROM quiz_history WHERE user_id=?", Long.class, userId);
    }

    private long createWord(String email, String eng) throws Exception {
        MvcResult result = mvc.perform(post("/api/vocab").with(auth(email)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("eng", eng, "vie", "meaning", "pos", "n"))))
                .andExpect(status().isOk()).andReturn();
        return body(result).path("id").asLong();
    }

    private JsonNode snapshot(String email) throws Exception {
        return body(mvc.perform(get("/api/snapshot").with(auth(email))).andExpect(status().isOk()).andReturn());
    }

    private void assertLearningStateUnchanged(JsonNode expected, JsonNode actual) {
        for (String field : List.of("vocab", "wrongWords", "quizHistory", "revision", "profile")) {
            assertThat(actual.path(field)).as(field).isEqualTo(expected.path(field));
        }
    }

    private boolean attemptExists(UUID id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM learning_attempt WHERE id=?", Integer.class, id) == 1;
    }

    private boolean itemExists(UUID id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM learning_attempt_item WHERE attempt_id=?", Integer.class, id) > 0;
    }

    private boolean historyExists(long id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM quiz_history WHERE id=?", Integer.class, id) == 1;
    }

    private int historyCount() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM quiz_history", Integer.class);
    }

    private boolean reviewOperationExists(UUID id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM review_operation WHERE id=?", Integer.class, id) == 1;
    }

    private JsonNode body(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }

    private Timestamp timestamp(Instant instant) {
        return Timestamp.from(instant.truncatedTo(ChronoUnit.MICROS));
    }

    private static RequestPostProcessor auth(String email) {
        var login = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Retention test");
        });
        return request -> csrf().postProcessRequest(login.postProcessRequest(request));
    }

    private record AttemptFixture(UUID attemptId, long historyId) { }
}
