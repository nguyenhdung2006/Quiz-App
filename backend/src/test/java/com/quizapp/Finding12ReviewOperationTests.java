package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import com.quizapp.review.ReviewOperationRepository;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id", "GOOGLE_CLIENT_SECRET=test-client-secret",
        "spring.datasource.url=jdbc:h2:mem:finding12review;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class Finding12ReviewOperationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DataSource database;
    @MockitoSpyBean ReviewOperationRepository operations;

    @ParameterizedTest
    @CsvSource({"review,true", "review,false", "known,true", "mark-hard,false"})
    void exactReplayPreservesOriginalOutcomeAndMutatesOnce(String action, boolean correct) throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long wordId = createDueWord(email, "focus");
        String payload = payload(UUID.randomUUID(), wordId, action, correct);
        JsonNode before = snapshot(email);
        MvcResult first = submit(email, action, payload);
        assertThat(first.getResponse().getStatus()).isEqualTo(200);
        JsonNode afterFirst = snapshot(email);
        MvcResult replay = submit(email, action, payload);
        assertThat(replay.getResponse().getStatus()).isEqualTo(200);
        JsonNode afterReplay = snapshot(email);
        assertThat(afterFirst.path("vocab").path(0).path("stats").path("seen").asInt()).isEqualTo(1);
        assertThat(afterReplay.path("vocab")).isEqualTo(afterFirst.path("vocab"));
        assertThat(afterReplay.path("wrongWords")).isEqualTo(afterFirst.path("wrongWords"));
        assertThat(afterFirst.path("revision").asLong()).isEqualTo(before.path("revision").asLong() + 1);
        assertThat(afterReplay.path("revision")).isEqualTo(afterFirst.path("revision"));
        assertThat(body(replay).path("outcome")).isEqualTo(body(first).path("outcome"));
        assertThat(body(replay).path("replayed").asBoolean()).isTrue();
        assertThat(first.getResponse().getHeader("X-Sync-Revision"))
                .isEqualTo(replay.getResponse().getHeader("X-Sync-Revision"));
        assertThat(ledgerCount(email)).isEqualTo(1);
        assertThat(afterReplay.path("profile").path("xp")).isEqualTo(before.path("profile").path("xp"));
        assertThat(afterReplay.path("quizHistory")).isEqualTo(before.path("quizHistory"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void staleDueStateCannotBeConsumedWithAnotherId(boolean correct) throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "stale");
        assertThat(submit(email, "review", payload(UUID.randomUUID(), word, "review", correct))
                .getResponse().getStatus()).isEqualTo(200);
        JsonNode accepted = snapshot(email);
        MvcResult stale = submit(email, "review", payload(UUID.randomUUID(), word, "review", !correct));
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        assertThat(body(stale).path("error").asText()).isEqualTo("REVIEW_NOT_DUE");
        assertLearningSame(accepted, snapshot(email));
        assertThat(ledgerCount(email)).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"known", "mark-hard"})
    void explicitNewCommandRetainsExistingProductSemantics(String action) throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "new intent");
        for (int i = 0; i < 2; i++) {
            assertThat(submit(email, action, payload(UUID.randomUUID(), word, action, "known".equals(action)))
                    .getResponse().getStatus()).isEqualTo(200);
        }
        JsonNode current = snapshot(email);
        assertThat(current.path("revision").asInt()).isEqualTo(3);
        assertThat(current.path("vocab").path(0).path("stats").path("seen").asInt()).isEqualTo(2);
        assertThat(current.path("vocab").path(0).path("stats").path("streak").asInt())
                .isEqualTo("known".equals(action) ? 3 : 0);
        assertThat(ledgerCount(email)).isEqualTo(2);
    }

    @Test
    void fingerprintIgnoresPropertyOrderAndNormalizesOnlyValidatedMode() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "canonical");
        UUID id = UUID.randomUUID();
        MvcResult first = submit(email, "review", payload(id, word, "review", true));
        MvcResult retry = submit(email, "review", "{\"mode\":\" REVIEW \",\"correct\":true,\"wordId\":"
                + word + ",\"operationId\":\"" + id + "\",\"seen\":999,\"revision\":999}");
        assertThat(retry.getResponse().getStatus()).isEqualTo(200);
        assertThat(body(retry).path("outcome")).isEqualTo(body(first).path("outcome"));
        assertThat(snapshot(email).path("revision").asInt()).isEqualTo(2);
    }

    @Test
    void changedWordCorrectnessAndActionConflictWithoutMutation() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "original"), other = createDueWord(email, "other");
        UUID id = UUID.randomUUID();
        assertThat(submit(email, "known", payload(id, word, "known", true)).getResponse().getStatus()).isEqualTo(200);
        JsonNode before = snapshot(email);
        for (String changed : List.of(payload(id, other, "known", true), payload(id, word, "review", true),
                payload(id, word, "mark-hard", false))) {
            assertThat(submit(email, changed.contains("mode") ? "review" : "known", changed)
                    .getResponse().getStatus()).isEqualTo(409);
        }
        UUID reviewId = UUID.randomUUID();
        submit(email, "review", payload(reviewId, other, "review", true));
        JsonNode afterReview = snapshot(email);
        assertThat(submit(email, "review", payload(reviewId, other, "review", false))
                .getResponse().getStatus()).isEqualTo(409);
        assertLearningSame(afterReview, snapshot(email));
        assertThat(afterReview.path("revision").asLong()).isEqualTo(before.path("revision").asLong() + 1);
        assertThat(ledgerCount(email)).isEqualTo(2);
    }

    @Test
    void replaySeparatesOriginalResultFromLatestWordAndRevision() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "current");
        String known = payload(UUID.randomUUID(), word, "known", true);
        MvcResult first = submit(email, "known", known);
        submit(email, "mark-hard", payload(UUID.randomUUID(), word, "mark-hard", false));
        JsonNode beforeRetry = snapshot(email);
        MvcResult retry = submit(email, "known", known);
        assertThat(body(retry).path("outcome")).isEqualTo(body(first).path("outcome"));
        assertThat(body(retry).path("outcome").path("resultingRevision").asInt()).isEqualTo(2);
        assertThat(body(retry).path("revision").asInt()).isEqualTo(3);
        assertThat(retry.getResponse().getHeader("X-Sync-Revision")).isEqualTo("3");
        assertThat(body(retry).path("word").path("stats").path("streak").asInt()).isZero();
        assertThat(body(retry).path("inWrongBank").asBoolean()).isTrue();
        assertLearningSame(beforeRetry, snapshot(email));
    }

    @Test
    void operationAndWordOwnershipAreBothRequired() throws Exception {
        String owner = UUID.randomUUID() + "@example.com", attacker = UUID.randomUUID() + "@example.com";
        long ownedWord = createDueWord(owner, "private"), attackerWord = createDueWord(attacker, "public");
        UUID id = UUID.randomUUID();
        String original = payload(id, ownedWord, "known", true);
        submit(owner, "known", original);
        JsonNode ownerBefore = snapshot(owner), attackerBefore = snapshot(attacker);
        for (String payload : List.of(original, payload(id, attackerWord, "known", true))) {
            MvcResult denied = submit(attacker, "known", payload);
            assertThat(denied.getResponse().getStatus()).isEqualTo(409);
            assertThat(body(denied).has("outcome")).isFalse();
        }
        assertThat(submit(attacker, "known", payload(UUID.randomUUID(), ownedWord, "known", true))
                .getResponse().getStatus()).isEqualTo(400);
        assertThat(submit(attacker, "review", payload(UUID.randomUUID(), ownedWord, "review", true))
                .getResponse().getStatus()).isEqualTo(400);
        assertLearningSame(ownerBefore, snapshot(owner));
        assertLearningSame(attackerBefore, snapshot(attacker));
        assertThat(ledgerCount(attacker)).isZero();
    }

    @Test
    void missingIdMalformedIdMissingCorrectUnknownModeAndNonexistentWordFailClosed() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "validation");
        JsonNode before = snapshot(email);
        for (String payload : List.of("{\"wordId\":" + word + ",\"correct\":true,\"mode\":\"review\"}",
                "{\"operationId\":\"broken\",\"wordId\":" + word + "}",
                "{\"operationId\":\"" + UUID.randomUUID() + "\",\"wordId\":" + word + ",\"mode\":\"review\"}",
                payload(UUID.randomUUID(), word, "quiz", true), payload(UUID.randomUUID(), word, "mark-hard", true),
                payload(UUID.randomUUID(), Long.MAX_VALUE, "review", true))) {
            assertThat(submit(email, "review", payload).getResponse().getStatus()).isEqualTo(400);
        }
        assertThat(submit(email, "known", "{\"wordId\":" + word + "}").getResponse().getStatus()).isEqualTo(400);
        assertLearningSame(before, snapshot(email));
        assertThat(ledgerCount(email)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"same", "conflict", "distinct"})
    void concurrentRequestsConsumeExactlyOnce(String scenario) throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "race");
        UUID firstId = UUID.randomUUID();
        String first = payload(firstId, word, "review", true);
        String second = payload("distinct".equals(scenario) ? UUID.randomUUID() : firstId,
                word, "review", !"conflict".equals(scenario));
        List<MvcResult> results = race(() -> submit(email, "review", first), () -> submit(email, "review", second));
        assertThat(results.stream().map(r -> r.getResponse().getStatus()).sorted().toList())
                .containsExactly(200, "same".equals(scenario) ? 200 : 409);
        JsonNode after = snapshot(email);
        assertThat(after.path("revision").asInt()).isEqualTo(2);
        assertThat(after.path("vocab").path(0).path("stats").path("seen").asInt()).isEqualTo(1);
        assertThat(ledgerCount(email)).isEqualTo(1);
        if ("same".equals(scenario)) assertThat(body(results.get(0)).path("outcome"))
                .isEqualTo(body(results.get(1)).path("outcome"));
    }

    @Test
    void ledgerFailureRollsBackLearningWrongBankAndRevision() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "rollback");
        JsonNode before = snapshot(email);
        doThrow(new IllegalStateException("simulated ledger persistence failure")).when(operations)
                .insert(any(), any(), any(), any(), any(), any(), anyInt(), anyInt(), any(), any(), anyLong());
        assertThat(submit(email, "review", payload(UUID.randomUUID(), word, "review", false))
                .getResponse().getStatus()).isEqualTo(500);
        assertLearningSame(before, snapshot(email));
        assertThat(ledgerCount(email)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"known", "mark-hard"})
    void concurrentCommandRetriesAlsoMutateOnce(String action) throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "command race");
        String payload = payload(UUID.randomUUID(), word, action, "known".equals(action));
        var results = race(() -> submit(email, action, payload), () -> submit(email, action, payload));
        assertThat(results.stream().map(r -> r.getResponse().getStatus()).toList()).containsExactly(200, 200);
        assertThat(body(results.get(0)).path("outcome")).isEqualTo(body(results.get(1)).path("outcome"));
        assertThat(snapshot(email).path("revision").asInt()).isEqualTo(2);
        assertThat(ledgerCount(email)).isEqualTo(1);
    }

    @Test
    void racingDifferentOwnersCannotClaimTheSameUuid() throws Exception {
        String a = UUID.randomUUID() + "@example.com", b = UUID.randomUUID() + "@example.com";
        long wordA = createDueWord(a, "owner a"), wordB = createDueWord(b, "owner b");
        UUID id = UUID.randomUUID();
        var results = race(() -> submit(a, "known", payload(id, wordA, "known", true)),
                () -> submit(b, "known", payload(id, wordB, "known", true)));
        assertThat(results.stream().map(r -> r.getResponse().getStatus()).sorted().toList()).containsExactly(200, 409);
        assertThat(ledgerCount(a) + ledgerCount(b)).isEqualTo(1);
        assertThat(snapshot(a).path("revision").asInt() + snapshot(b).path("revision").asInt()).isEqualTo(3);
        assertThat(snapshot(a).path("vocab").path(0).path("stats").path("seen").asInt()
                + snapshot(b).path("vocab").path(0).path("stats").path("seen").asInt()).isEqualTo(1);
    }

    @Test
    void nullDueScheduleIsNotAnAvailableReview() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "not due");
        try (var connection = database.getConnection(); var statement = connection.prepareStatement(
                "UPDATE word_stats SET next_review = NULL WHERE word_id = ?")) {
            statement.setLong(1, word); statement.executeUpdate();
        }
        JsonNode before = snapshot(email);
        assertThat(submit(email, "review", payload(UUID.randomUUID(), word, "review", true))
                .getResponse().getStatus()).isEqualTo(409);
        assertLearningSame(before, snapshot(email));
    }

    @Test
    void replayAfterWordDeletionRetainsOutcomeWithoutResurrection() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "deleted");
        String payload = payload(UUID.randomUUID(), word, "known", true);
        MvcResult first = submit(email, "known", payload);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/vocab/{id}", word)
                .with(auth(email))).andExpect(status().isOk());
        MvcResult replay = submit(email, "known", payload);
        assertThat(replay.getResponse().getStatus()).isEqualTo(200);
        assertThat(body(replay).path("outcome")).isEqualTo(body(first).path("outcome"));
        assertThat(body(replay).path("word").isNull()).isTrue();
        assertThat(snapshot(email).path("vocab")).isEmpty();
        assertThat(snapshot(email).path("revision").asInt()).isEqualTo(3);
    }

    @Test
    void oldHardReplayDoesNotReintroduceClearedWrongBankEntry() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        long word = createDueWord(email, "cleared mistake");
        String hard = payload(UUID.randomUUID(), word, "mark-hard", false);
        MvcResult first = submit(email, "mark-hard", hard);
        for (int i = 0; i < 4; i++) submit(email, "known", payload(UUID.randomUUID(), word, "known", true));
        JsonNode beforeClear = snapshot(email);
        var sync = json.createObjectNode();
        sync.put("syncContractVersion", 2).put("expectedRevision", beforeClear.path("revision").asLong());
        sync.set("vocab", beforeClear.path("vocab"));
        sync.putArray("deletions"); sync.putArray("wrongWords");
        sync.putArray("wrongWordDeletions").addObject()
                .put("wordUid", beforeClear.path("vocab").path(0).path("wordUid").asText());
        mvc.perform(post("/api/sync").with(auth(email)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(sync))).andExpect(status().isOk());
        JsonNode beforeReplay = snapshot(email);
        MvcResult replay = submit(email, "mark-hard", hard);
        assertThat(body(replay).path("outcome")).isEqualTo(body(first).path("outcome"));
        assertThat(body(replay).path("inWrongBank").asBoolean()).isFalse();
        assertThat(body(replay).path("word").path("mastered").asBoolean()).isTrue();
        assertLearningSame(beforeReplay, snapshot(email));
    }

    private void assertLearningSame(JsonNode expected, JsonNode actual) {
        for (String field : List.of("vocab", "wrongWords", "revision", "quizHistory")) {
            assertThat(actual.path(field)).as(field).isEqualTo(expected.path(field));
        }
        assertThat(actual.path("profile").path("xp")).isEqualTo(expected.path("profile").path("xp"));
    }

    private int ledgerCount(String email) throws Exception {
        try (var connection = database.getConnection(); var statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM review_operation r JOIN app_users u ON r.user_id = u.id WHERE u.email = ?")) {
            statement.setString(1, email);
            try (var rows = statement.executeQuery()) { rows.next(); return rows.getInt(1); }
        }
    }

    private List<MvcResult> race(Callable<MvcResult> first, Callable<MvcResult> second) throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            var futures = List.of(first, second).stream().map(call -> pool.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("start timeout");
                return call.call();
            })).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(futures.get(0).get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); }
    }

    private long createDueWord(String email, String eng) throws Exception {
        JsonNode word = body(mvc.perform(post("/api/vocab").with(auth(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("eng", eng, "vie", "meaning"))))
                .andExpect(status().isOk()).andReturn());
        try (var connection = database.getConnection();
             var statement = connection.prepareStatement("UPDATE word_stats SET next_review = ? WHERE word_id = ?")) {
            statement.setTimestamp(1, Timestamp.from(Instant.now().minusSeconds(86400)));
            statement.setLong(2, word.path("id").asLong());
            statement.executeUpdate();
        }
        return word.path("id").asLong();
    }

    private String payload(UUID operationId, long wordId, String action, boolean correct) throws Exception {
        return json.writeValueAsString("known".equals(action)
                ? Map.of("operationId", operationId, "wordId", wordId)
                : Map.of("operationId", operationId, "wordId", wordId, "correct", correct, "mode", action));
    }

    private MvcResult submit(String email, String action, String payload) throws Exception {
        return mvc.perform(post("known".equals(action) ? "/api/review/known" : "/api/review/answer")
                .with(auth(email)).contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn();
    }

    private JsonNode snapshot(String email) throws Exception {
        return body(mvc.perform(get("/api/snapshot").with(auth(email))).andExpect(status().isOk()).andReturn());
    }

    private JsonNode body(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }

    private static RequestPostProcessor auth(String email) {
        var login = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Review test");
        });
        return request -> csrf().postProcessRequest(login.postProcessRequest(request));
    }
}
