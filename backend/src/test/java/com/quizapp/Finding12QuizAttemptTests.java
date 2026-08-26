package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.quiz.CreateQuizAttemptItemRequest;
import com.quizapp.quiz.CreateQuizAttemptRequest;
import com.quizapp.quiz.QuizAttemptConflictException;
import com.quizapp.quiz.QuizAttemptResponse;
import com.quizapp.quiz.QuizAttemptSelectionRequest;
import com.quizapp.quiz.QuizAttemptService;
import com.quizapp.quiz.QuizAttemptSubmitResponse;
import com.quizapp.quiz.SubmitQuizAttemptRequest;
import com.quizapp.quiz.QuizAttemptClock;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.vocab.QuizHistoryRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "spring.datasource.url=jdbc:h2:mem:finding12attempts;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class Finding12QuizAttemptTests {
    private static final Instant BASE_TIME = Instant.parse("2026-08-25T01:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private VocabularyRepository words;

    @Autowired
    private QuizHistoryRepository quizHistory;

    @Autowired
    private QuizAttemptService attemptService;

    @MockitoBean
    private QuizAttemptClock clock;

    private final AtomicReference<Instant> now = new AtomicReference<>(BASE_TIME);

    @BeforeEach
    void useDeterministicAttemptTime() {
        now.set(BASE_TIME);
        when(clock.now()).thenAnswer(ignored -> now.get());
    }

    @Test
    void issuanceIsAuthenticatedOwnedBoundedAndRejectsDuplicatesAndUnsupportedModes() throws Exception {
        String owner = uniqueEmail("issue-owner");
        String other = uniqueEmail("issue-other");
        long ownerWord = createWord(owner, "focus", "tap trung");
        long otherWord = createWord(other, "private", "rieng tu");

        MvcResult issued = issue(owner, "quiz", List.of(item(ownerWord, "eng")), status().isOk());
        JsonNode body = body(issued);
        assertThat(body.path("attemptId").asText()).isNotBlank();
        assertThat(body.path("createdAt").asText()).isEqualTo(BASE_TIME.toString());
        assertThat(body.path("expiresAt").asText()).isEqualTo("2026-08-26T01:00:00Z");
        assertThat(body.path("items").size()).isEqualTo(1);
        assertThat(body.path("items").get(0).path("prompt").asText()).isEqualTo("focus");
        assertThat(body.path("items").get(0).has("correctAnswer")).isFalse();

        issue(owner, "quiz", List.of(item(otherWord, "eng")), status().isBadRequest());
        issue(owner, "quiz", List.of(item(9_999_999L, "eng")), status().isBadRequest());
        issue(owner, "quiz", List.of(item(ownerWord, "eng"), item(ownerWord, "vie")), status().isBadRequest());
        issue(owner, "unsupported", List.of(item(ownerWord, "eng")), status().isBadRequest());
        issue(owner, " QUIZ ", List.of(item(ownerWord, "eng")), status().isBadRequest());
        issue(owner, "QUIZ", List.of(item(ownerWord, "eng")), status().isBadRequest());
        issue(owner, "quiz", List.of(item(ownerWord, "mixed")), status().isBadRequest());
        issue(owner, "quiz", List.of(), status().isBadRequest());

        for (String productMode : List.of("quick-add", "focus", "weak-words")) {
            issue(owner, productMode, List.of(item(ownerWord, "eng")), status().isOk());
        }

        List<Map<String, Object>> tooMany = new ArrayList<>();
        for (int index = 0; index < 501; index++) {
            tooMany.add(item(ownerWord, "eng"));
        }
        issue(owner, "quiz", tooMany, status().isBadRequest());

        mockMvc.perform(post("/api/quiz/attempts")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "quizMode", "quiz",
                                "items", List.of(item(ownerWord, "eng"))
                        ))))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "http://localhost/oauth2/authorization/google"));
    }

    @Test
    void validSubmitUsesServerScoringAndMutatesRewardsHistoryAndRevisionOnce() throws Exception {
        String email = uniqueEmail("valid");
        long correctWord = createWord(email, "focus", "tap trung");
        long wrongWord = createWord(email, "calm", "binh tinh");
        UUID attemptId = attemptId(issue(
                email,
                "quiz",
                List.of(item(correctWord, "eng"), item(wrongWord, "vie")),
                status().isOk()
        ));

        MvcResult result = mockMvc.perform(post("/api/quiz/attempts/" + attemptId + "/submit")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "score": 999,
                                  "correctAnswers": 99,
                                  "answers": [
                                    {"ordinal": 0, "selectedAnswer": "tap trung", "correct": false},
                                    {"ordinal": 1, "selectedAnswer": "not calm", "correct": true}
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Sync-Revision", "3"))
                .andExpect(jsonPath("$.replayed").value(false))
                .andExpect(jsonPath("$.outcome.totalQuestions").value(2))
                .andExpect(jsonPath("$.outcome.correctAnswers").value(1))
                .andExpect(jsonPath("$.outcome.wrongAnswers").value(1))
                .andExpect(jsonPath("$.outcome.score").value(5.0))
                .andExpect(jsonPath("$.outcome.maxCombo").value(1))
                .andExpect(jsonPath("$.outcome.awardedQuizXp").value(19))
                .andExpect(jsonPath("$.outcome.resultingSyncRevision").value(3))
                .andExpect(jsonPath("$.snapshot.revision").value(3))
                .andReturn();

        assertThat(body(result).path("outcome").has("quizHistoryId")).isTrue();
        AppUser user = user(email);
        assertThat(user.getXp()).isEqualTo(49);
        assertThat(user.getSyncRevision()).isEqualTo(3);
        assertThat(quizHistory.countByUser(user)).isEqualTo(1);

        VocabularyWord correct = ownedWord(email, correctWord);
        VocabularyWord wrong = ownedWord(email, wrongWord);
        assertThat(correct.getStats().getSeen()).isEqualTo(1);
        assertThat(correct.getStats().getCorrect()).isEqualTo(1);
        assertThat(correct.getStats().getCurrentStreak()).isEqualTo(1);
        assertThat(correct.getStats().getMasteryLevel()).isEqualTo(1);
        assertThat(wrong.getStats().getSeen()).isEqualTo(1);
        assertThat(wrong.getStats().getWrong()).isEqualTo(1);
    }

    @Test
    void manufacturedMissingExtraDuplicateAndUnissuedItemsAreRejectedWithoutMutation() throws Exception {
        String email = uniqueEmail("manufactured");
        long first = createWord(email, "focus", "tap trung");
        long second = createWord(email, "calm", "binh tinh");
        UUID missingAttempt = issuedAttempt(email, first, second);
        submit(email, missingAttempt, List.of(answer(0, "tap trung")), status().isBadRequest());

        UUID duplicateAttempt = issuedAttempt(email, first, second);
        submit(email, duplicateAttempt, List.of(answer(0, "tap trung"), answer(0, "tap trung")), status().isBadRequest());

        UUID unissuedAttempt = issuedAttempt(email, first, second);
        submit(email, unissuedAttempt, List.of(answer(0, "tap trung"), answer(2, "focus")), status().isBadRequest());

        UUID extraAttempt = attemptId(issue(email, "quiz", List.of(item(first, "eng")), status().isOk()));
        submit(email, extraAttempt, List.of(answer(0, "tap trung"), answer(1, "anything")), status().isBadRequest());

        AppUser user = user(email);
        assertThat(user.getSyncRevision()).isEqualTo(2);
        assertThat(quizHistory.countByUser(user)).isZero();
        assertThat(ownedWord(email, first).getStats().getSeen()).isZero();
        assertThat(ownedWord(email, second).getStats().getSeen()).isZero();
    }

    @Test
    void exactReplayReturnsOriginalOutcomeWithoutSecondMutationAndConflictReplayFails() throws Exception {
        String email = uniqueEmail("replay");
        long wordId = createWord(email, "focus", "tap trung");
        UUID attemptId = attemptId(issue(email, "quiz", List.of(item(wordId, "eng")), status().isOk()));

        MvcResult first = submit(email, attemptId, List.of(answer(0, "  tap   trung ")), status().isOk());
        createWord(email, "calm", "binh tinh");
        MvcResult replay = submit(email, attemptId, List.of(answer(0, "tap trung")), status().isOk());
        submit(email, attemptId, List.of(answer(0, "wrong")), status().isConflict())
                .getResponse();
        issue(email, "quiz", List.of(item(wordId, "eng")), status().isOk());

        JsonNode firstBody = body(first);
        JsonNode replayBody = body(replay);
        assertThat(firstBody.path("replayed").asBoolean()).isFalse();
        assertThat(replayBody.path("replayed").asBoolean()).isTrue();
        assertThat(replayBody.path("outcome")).isEqualTo(firstBody.path("outcome"));
        assertThat(replay.getResponse().getHeader("X-Sync-Revision")).isEqualTo("3");
        assertThat(replayBody.path("outcome").path("resultingSyncRevision").asLong()).isEqualTo(2);
        assertThat(replayBody.path("snapshot").path("revision").asLong()).isEqualTo(3);

        AppUser user = user(email);
        assertThat(user.getSyncRevision()).isEqualTo(3);
        assertThat(user.getXp()).isEqualTo(96);
        assertThat(quizHistory.countByUser(user)).isEqualTo(1);
        assertThat(ownedWord(email, wordId).getStats().getSeen()).isEqualTo(1);
        assertThat(ownedWord(email, wordId).getStats().getCurrentStreak()).isEqualTo(1);
    }

    @Test
    void canonicalReplayIgnoresAnswerAndJsonPropertyOrderButBindsEachOrdinal() throws Exception {
        String email = uniqueEmail("canonical");
        long firstWord = createWord(email, "focus", "tap trung");
        long secondWord = createWord(email, "calm", "binh tinh");
        UUID attemptId = issuedAttempt(email, firstWord, secondWord);

        MvcResult first = mockMvc.perform(post("/api/quiz/attempts/" + attemptId + "/submit")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "score": 1,
                                  "answers": [
                                    {"ordinal": 0, "selectedAnswer": "tap trung"},
                                    {"ordinal": 1, "selectedAnswer": "calm"}
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult replay = mockMvc.perform(post("/api/quiz/attempts/" + attemptId + "/submit")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "answers": [
                                    {"selectedAnswer": "calm", "ordinal": 1},
                                    {"selectedAnswer": "  tap   trung ", "ordinal": 0}
                                  ],
                                  "score": 999
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.replayed").value(true))
                .andReturn();

        assertThat(body(replay).path("outcome")).isEqualTo(body(first).path("outcome"));
        submit(
                email,
                attemptId,
                List.of(answer(0, "calm"), answer(1, "tap trung")),
                status().isConflict()
        );

        AppUser user = user(email);
        assertThat(user.getSyncRevision()).isEqualTo(3);
        assertThat(quizHistory.countByUser(user)).isEqualTo(1);
        assertThat(ownedWord(email, firstWord).getStats().getSeen()).isEqualTo(1);
        assertThat(ownedWord(email, secondWord).getStats().getSeen()).isEqualTo(1);
    }

    @Test
    void anotherUserCannotSubmitAttemptAndCannotChangeItsOwnerState() throws Exception {
        String owner = uniqueEmail("idor-owner");
        String attacker = uniqueEmail("idor-attacker");
        long wordId = createWord(owner, "focus", "tap trung");
        createWord(attacker, "other", "khac");
        UUID attemptId = attemptId(issue(owner, "quiz", List.of(item(wordId, "eng")), status().isOk()));

        submit(attacker, attemptId, List.of(answer(0, "tap trung")), status().isBadRequest());
        assertThat(user(owner).getSyncRevision()).isEqualTo(1);
        assertThat(quizHistory.countByUser(user(owner))).isZero();

        submit(owner, attemptId, List.of(answer(0, "tap trung")), status().isOk());
        assertThat(user(owner).getSyncRevision()).isEqualTo(2);
        assertThat(user(attacker).getSyncRevision()).isEqualTo(1);
        assertThat(quizHistory.countByUser(user(owner))).isEqualTo(1);
        assertThat(quizHistory.countByUser(user(attacker))).isZero();
    }

    @Test
    void expiredAttemptFailsClosedWithoutLearningMutation() throws Exception {
        String email = uniqueEmail("expired");
        long wordId = createWord(email, "focus", "tap trung");
        UUID attemptId = attemptId(issue(email, "quiz", List.of(item(wordId, "eng")), status().isOk()));
        now.set(BASE_TIME.plusSeconds(24 * 60 * 60));

        MvcResult result = submit(email, attemptId, List.of(answer(0, "tap trung")), status().isConflict());
        assertThat(body(result).path("error").asText()).isEqualTo("QUIZ_ATTEMPT_EXPIRED");
        assertThat(user(email).getSyncRevision()).isEqualTo(1);
        assertThat(quizHistory.countByUser(user(email))).isZero();
        assertThat(ownedWord(email, wordId).getStats().getSeen()).isZero();
    }

    @Test
    void answerContextIsCapturedWhenAttemptIsIssued() throws Exception {
        String email = uniqueEmail("edit-after-issue");
        long wordId = createWord(email, "focus", "tap trung");
        UUID attemptId = attemptId(issue(email, "quiz", List.of(item(wordId, "eng")), status().isOk()));

        mockMvc.perform(put("/api/vocab/" + wordId)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "focus",
                                "vie", "chu y",
                                "pos", "v",
                                "tag", "study"
                        ))))
                .andExpect(status().isOk());

        MvcResult result = submit(email, attemptId, List.of(answer(0, "tap trung")), status().isOk());
        assertThat(body(result).path("outcome").path("correctAnswers").asInt()).isEqualTo(1);
        assertThat(body(result).path("outcome").path("resultingSyncRevision").asLong()).isEqualTo(3);
        assertThat(ownedWord(email, wordId).getVie()).isEqualTo("chu y");
    }

    @Test
    void concurrentIdenticalSubmissionsMutateOnceAndBothRecoverSuccess() throws Exception {
        String email = uniqueEmail("concurrent-same");
        long wordId = createWord(email, "focus", "tap trung");
        QuizAttemptResponse attempt = attemptService.issue(
                user(email),
                new CreateQuizAttemptRequest("quiz", null, List.of(new CreateQuizAttemptItemRequest(wordId, "eng")))
        );
        SubmitQuizAttemptRequest submission = new SubmitQuizAttemptRequest(
                List.of(new QuizAttemptSelectionRequest(0, "tap trung"))
        );

        List<QuizAttemptSubmitResponse> results = runConcurrent(
                () -> attemptService.submit(user(email), attempt.attemptId(), submission),
                () -> attemptService.submit(user(email), attempt.attemptId(), submission)
        );

        assertThat(results).extracting(QuizAttemptSubmitResponse::replayed).containsExactlyInAnyOrder(false, true);
        assertThat(user(email).getSyncRevision()).isEqualTo(2);
        assertThat(quizHistory.countByUser(user(email))).isEqualTo(1);
        assertThat(ownedWord(email, wordId).getStats().getSeen()).isEqualTo(1);
    }

    @Test
    void concurrentConflictingSubmissionsAllowOnlyOneRewardMutation() throws Exception {
        String email = uniqueEmail("concurrent-conflict");
        long wordId = createWord(email, "focus", "tap trung");
        QuizAttemptResponse attempt = attemptService.issue(
                user(email),
                new CreateQuizAttemptRequest("quiz", null, List.of(new CreateQuizAttemptItemRequest(wordId, "eng")))
        );
        SubmitQuizAttemptRequest correct = new SubmitQuizAttemptRequest(
                List.of(new QuizAttemptSelectionRequest(0, "tap trung"))
        );
        SubmitQuizAttemptRequest wrong = new SubmitQuizAttemptRequest(
                List.of(new QuizAttemptSelectionRequest(0, "wrong"))
        );

        assertThatThrownBy(() -> runConcurrent(
                () -> attemptService.submit(user(email), attempt.attemptId(), correct),
                () -> attemptService.submit(user(email), attempt.attemptId(), wrong)
        )).hasRootCauseInstanceOf(QuizAttemptConflictException.class);

        assertThat(user(email).getSyncRevision()).isEqualTo(2);
        assertThat(quizHistory.countByUser(user(email))).isEqualTo(1);
        assertThat(ownedWord(email, wordId).getStats().getSeen()).isEqualTo(1);
    }

    private List<QuizAttemptSubmitResponse> runConcurrent(
            java.util.concurrent.Callable<QuizAttemptSubmitResponse> first,
            java.util.concurrent.Callable<QuizAttemptSubmitResponse> second
    ) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<QuizAttemptSubmitResponse> firstResult = executor.submit(() -> {
                ready.countDown();
                start.await();
                return first.call();
            });
            Future<QuizAttemptSubmitResponse> secondResult = executor.submit(() -> {
                ready.countDown();
                start.await();
                return second.call();
            });
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(firstResult.get(15, TimeUnit.SECONDS), secondResult.get(15, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    private UUID issuedAttempt(String email, long first, long second) throws Exception {
        return attemptId(issue(
                email,
                "quiz",
                List.of(item(first, "eng"), item(second, "vie")),
                status().isOk()
        ));
    }

    private MvcResult issue(
            String email,
            String quizMode,
            List<Map<String, Object>> items,
            org.springframework.test.web.servlet.ResultMatcher expectedStatus
    ) throws Exception {
        return mockMvc.perform(post("/api/quiz/attempts")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "quizMode", quizMode,
                                "items", items
                        ))))
                .andExpect(expectedStatus)
                .andReturn();
    }

    private MvcResult submit(
            String email,
            UUID attemptId,
            List<Map<String, Object>> answers,
            org.springframework.test.web.servlet.ResultMatcher expectedStatus
    ) throws Exception {
        return mockMvc.perform(post("/api/quiz/attempts/" + attemptId + "/submit")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("answers", answers))))
                .andExpect(expectedStatus)
                .andReturn();
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
        return body(result).path("id").asLong();
    }

    private AppUser user(String email) {
        return users.findByEmailIgnoreCase(email).orElseThrow();
    }

    private VocabularyWord ownedWord(String email, long wordId) {
        return words.findByIdAndUser(wordId, user(email)).orElseThrow();
    }

    private UUID attemptId(MvcResult result) throws Exception {
        return UUID.fromString(body(result).path("attemptId").asText());
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Map<String, Object> item(long wordId, String questionMode) {
        return Map.of("wordId", wordId, "questionMode", questionMode);
    }

    private Map<String, Object> answer(int ordinal, String selectedAnswer) {
        return Map.of("ordinal", ordinal, "selectedAnswer", selectedAnswer);
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Attempt Test User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
