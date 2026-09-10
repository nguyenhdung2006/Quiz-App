package com.quizapp;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.review.SpacedRepetitionService;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import javax.sql.DataSource;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class SpacedRepetitionTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    @Test
    void correctAnswerAtStreakOneSchedulesOneDay() {
        SpacedRepetitionService service = new SpacedRepetitionService(null);
        VocabularyWord word = wordWithStats(0, 0);
        Instant now = Instant.parse("2026-06-05T03:00:00Z");

        WordStats stats = service.applyAnswer(word, true, now);

        org.assertj.core.api.Assertions.assertThat(stats.getCurrentStreak()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(stats.getNextReview()).isEqualTo(now.plus(Duration.ofDays(1)));
    }

    @Test
    void correctAnswerAtStreakTwoSchedulesThreeDays() {
        SpacedRepetitionService service = new SpacedRepetitionService(null);
        VocabularyWord word = wordWithStats(1, 1);
        Instant now = Instant.parse("2026-06-05T03:00:00Z");

        WordStats stats = service.applyAnswer(word, true, now);

        org.assertj.core.api.Assertions.assertThat(stats.getCurrentStreak()).isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(stats.getNextReview()).isEqualTo(now.plus(Duration.ofDays(3)));
    }

    @Test
    void wrongAnswerReducesMasteryAndSchedulesSooner() {
        SpacedRepetitionService service = new SpacedRepetitionService(null);
        VocabularyWord word = wordWithStats(2, 3);
        Instant now = Instant.parse("2026-06-05T03:00:00Z");

        WordStats stats = service.applyAnswer(word, false, now);

        org.assertj.core.api.Assertions.assertThat(stats.getCurrentStreak()).isZero();
        org.assertj.core.api.Assertions.assertThat(stats.getMasteryLevel()).isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(stats.getNextReview()).isEqualTo(now.plus(Duration.ofDays(1)));
    }

    @Test
    void corruptedStatsAreClampedBeforeScheduling() {
        SpacedRepetitionService service = new SpacedRepetitionService(null);
        VocabularyWord word = wordWithStats(-5, 99);
        WordStats existing = word.getStats();
        existing.setSeen(-10);
        existing.setCorrect(-20);
        existing.setWrong(2_000_000);
        existing.setBestStreak(-1);
        Instant now = Instant.parse("2026-06-05T03:00:00Z");

        WordStats stats = service.applyAnswer(word, true, now);

        org.assertj.core.api.Assertions.assertThat(stats.getSeen()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(stats.getCorrect()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(stats.getWrong()).isEqualTo(1_000_000);
        org.assertj.core.api.Assertions.assertThat(stats.getCurrentStreak()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(stats.getBestStreak()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(stats.getMasteryLevel()).isEqualTo(5);
        org.assertj.core.api.Assertions.assertThat(stats.getNextReview()).isEqualTo(now.plus(Duration.ofDays(1)));
    }

    @Test
    void nullReviewTimestampFallsBackSafely() {
        SpacedRepetitionService service = new SpacedRepetitionService(null);
        VocabularyWord word = wordWithStats(0, 0);

        WordStats stats = service.applyAnswer(word, false, null);

        org.assertj.core.api.Assertions.assertThat(stats.getLastReviewed()).isNotNull();
        org.assertj.core.api.Assertions.assertThat(stats.getNextReview()).isAfter(stats.getLastReviewed());
    }

    @Test
    void todayEndpointOnlyReturnsCurrentUsersDueWords() throws Exception {
        createWord("review-a@example.com", "negotiate", "dam phan", Instant.now().minus(Duration.ofDays(1)));
        createWord("review-b@example.com", "invoice", "hoa don", Instant.now().minus(Duration.ofDays(1)));

        mockMvc.perform(get("/api/review/today")
                        .with(oauthUser("review-a@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)))
                .andExpect(jsonPath("$[0].eng", is("negotiate")))
                .andExpect(jsonPath("$[*].eng", everyItem(not("invoice"))));
    }

    @Test
    void queueEndpointReturnsOkForLoggedInUserWithoutDueWords() throws Exception {
        mockMvc.perform(get("/api/review/queue")
                        .param("limit", "8")
                        .with(oauthUser("review-empty@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(0)));
    }

    @Test
    void answerEndpointUpdatesWordStats() throws Exception {
        long wordId = createWord("review-answer@example.com", "focus", "tap trung", Instant.now().minus(Duration.ofDays(1)));

        mockMvc.perform(post("/api/review/answer")
                        .with(oauthUser("review-answer@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "operationId", java.util.UUID.randomUUID(), "wordId", wordId,
                                "correct", true,
                                "mode", "review"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome.wordId", is((int) wordId)))
                .andExpect(jsonPath("$.outcome.streak", is(1)))
                .andExpect(jsonPath("$.outcome.mastery", is(20)))
                .andExpect(jsonPath("$.outcome.nextReview", not(nullValue())));

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser("review-answer@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].stats.correct", is(1)))
                .andExpect(jsonPath("$[0].stats.seen", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$[0].stats.nextReview", not(nullValue())));
    }

    private VocabularyWord wordWithStats(int currentStreak, int masteryLevel) {
        VocabularyWord word = new VocabularyWord();
        word.setEng("focus");
        word.setVie("tap trung");
        WordStats stats = new WordStats();
        stats.setCurrentStreak(currentStreak);
        stats.setMasteryLevel(masteryLevel);
        word.setStats(stats);
        return word;
    }

    private long createWord(String email, String eng, String vie, Instant nextReview) throws Exception {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("seen", 0);
        stats.put("correct", 0);
        stats.put("wrong", 0);
        stats.put("streak", 0);
        stats.put("bestStreak", 0);
        stats.put("masteryLevel", 0);
        stats.put("nextReview", nextReview.toString());

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("eng", eng);
        request.put("vie", vie);
        request.put("pos", "n");
        request.put("tag", "review");
        request.put("level", "B1");
        request.put("stats", stats);

        MvcResult result = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        long wordId = created.get("id").asLong();
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("UPDATE word_stats SET next_review = ? WHERE word_id = ?")) {
            statement.setObject(1, java.sql.Timestamp.from(nextReview));
            statement.setLong(2, wordId);
            statement.executeUpdate();
        }
        return wordId;
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Review User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
