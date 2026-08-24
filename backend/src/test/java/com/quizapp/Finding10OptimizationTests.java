package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.vocab.QuizHistory;
import com.quizapp.vocab.QuizHistoryRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "spring.datasource.url=jdbc:h2:mem:finding10optimization;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class Finding10OptimizationTests {
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

    @Test
    void databaseLimitedReviewQueueMatchesUnboundedOrderingAndCount() throws Exception {
        String email = "finding10-review-parity@example.com";
        AppUser user = createUser(email);
        Instant now = Instant.now();
        List<VocabularyWord> seeded = new ArrayList<>();
        for (int index = 0; index < 12; index++) {
            VocabularyWord word = word(user, "review parity " + index, now.minus(Duration.ofDays(index % 7 + 1L)));
            word.getStats().setMasteryLevel(index % 6);
            word.getStats().setWrong(index % 5);
            if (index >= 10) word.setTag("general");
            if (index == 9) word.setLevel("A2");
            seeded.add(word);
        }
        words.saveAllAndFlush(seeded);

        AppUser otherUser = createUser("finding10-review-other@example.com");
        VocabularyWord otherUsersHighPriorityWord = word(
                otherUser,
                "other user private review",
                now.minus(Duration.ofDays(7))
        );
        otherUsersHighPriorityWord.getStats().setWrong(5);
        words.saveAndFlush(otherUsersHighPriorityWord);

        JsonNode unlimited = getJson(email, "/api/review/queue?tag=review&level=B1");
        JsonNode limitOne = getJson(email, "/api/review/queue?tag=review&level=B1&limit=1");
        JsonNode limited = getJson(email, "/api/review/queue?tag=review&level=B1&limit=5");
        JsonNode largerThanAvailable = getJson(email, "/api/review/queue?tag=review&level=B1&limit=50");

        assertThat(unlimited.size()).isEqualTo(9);
        assertThat(ids(limitOne)).containsExactly(ids(unlimited).get(0));
        assertThat(limited.size()).isEqualTo(5);
        assertThat(ids(limited)).containsExactlyElementsOf(ids(unlimited).subList(0, 5));
        assertThat(ids(largerThanAvailable)).containsExactlyElementsOf(ids(unlimited));
        assertThat(priorities(limited)).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        assertThat(priorities(unlimited).subList(0, 2)).containsOnly(100);
        assertThat(ids(unlimited).subList(0, 2)).containsExactly(
                seeded.get(6).getId(),
                seeded.get(0).getId()
        );
        assertThat(ids(unlimited)).doesNotContain(otherUsersHighPriorityWord.getId());
    }

    @Test
    void targetedProgressAndAnalyticsPreserveSnapshotVisibleTotals() throws Exception {
        String email = "finding10-progress-parity@example.com";
        AppUser user = createUser(email);
        Instant now = Instant.now();
        words.saveAllAndFlush(List.of(
                word(user, "due one", now.minus(Duration.ofDays(2))),
                word(user, "due two", now.minus(Duration.ofHours(2))),
                word(user, "future one", now.plus(Duration.ofDays(2)))
        ));
        quizHistory.saveAllAndFlush(List.of(
                history(user, 8, 10, 8.0),
                history(user, 6, 10, 6.0)
        ));

        JsonNode snapshot = getJson(email, "/api/snapshot");
        JsonNode progress = getJson(email, "/api/progress");
        JsonNode analytics = getJson(email, "/api/analytics/overview");

        assertThat(progress).isEqualTo(snapshot.path("progress"));
        assertThat(progress.path("totalQuizzes").asLong()).isEqualTo(2);
        assertThat(progress.path("weeklyQuizzes").asInt()).isEqualTo(2);
        assertThat(progress.path("weeklyCorrectAnswers").asInt()).isEqualTo(14);
        assertThat(progress.path("weeklyAverageScore").asDouble()).isEqualTo(7.0);
        assertThat(progress.path("dueToday").asLong()).isEqualTo(2);
        assertThat(analytics.path("totalQuizSessions").asLong()).isEqualTo(2);
    }

    @Test
    void emptyProgressStaysZeroAndIgnoresAnotherUsersData() throws Exception {
        String emptyEmail = "finding10-progress-empty@example.com";
        createUser(emptyEmail);

        String otherEmail = "finding10-progress-other@example.com";
        AppUser otherUser = createUser(otherEmail);
        words.saveAndFlush(word(otherUser, "other user due word", Instant.now().minus(Duration.ofDays(1))));
        quizHistory.saveAndFlush(history(otherUser, 9, 10, 9.0));

        JsonNode progress = getJson(emptyEmail, "/api/progress");
        JsonNode snapshot = getJson(emptyEmail, "/api/snapshot");

        assertThat(progress).isEqualTo(snapshot.path("progress"));
        assertThat(progress.path("totalQuizzes").asLong()).isZero();
        assertThat(progress.path("weeklyQuizzes").asLong()).isZero();
        assertThat(progress.path("weeklyCorrectAnswers").asInt()).isZero();
        assertThat(progress.path("weeklyAverageScore").asDouble()).isZero();
        assertThat(progress.path("dueToday").asLong()).isZero();
        assertThat(progress.path("unlockedAchievements").asInt()).isZero();
    }

    private AppUser createUser(String email) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setGoogleSubject("sub-" + email);
        user.setDisplayName("Finding 10 Test");
        return users.saveAndFlush(user);
    }

    private VocabularyWord word(AppUser user, String english, Instant nextReview) {
        VocabularyWord word = new VocabularyWord();
        word.setUser(user);
        word.setWordUid(UUID.randomUUID());
        word.setEng(english);
        word.setVie("meaning of " + english);
        word.setPos("n");
        word.setTag("review");
        word.setLevel("B1");
        WordStats stats = new WordStats();
        stats.setNextReview(nextReview);
        word.setStats(stats);
        return word;
    }

    private QuizHistory history(AppUser user, int correct, int total, double score) {
        QuizHistory history = new QuizHistory();
        history.setUser(user);
        history.setQuizMode("mixed");
        history.setTotalQuestions(total);
        history.setCorrectAnswers(correct);
        history.setWrongAnswers(total - correct);
        history.setScore(score);
        return history;
    }

    private JsonNode getJson(String email, String path) throws Exception {
        String body = mockMvc.perform(get(path).with(oauthUser(email)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body);
    }

    private List<Long> ids(JsonNode queue) {
        List<Long> result = new ArrayList<>();
        queue.forEach(item -> result.add(item.path("wordId").asLong()));
        return result;
    }

    private List<Integer> priorities(JsonNode queue) {
        List<Integer> result = new ArrayList<>();
        queue.forEach(item -> result.add(item.path("priority").asInt()));
        return result;
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Finding 10 Test");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
