package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import com.quizapp.vocab.WordTombstone;
import com.quizapp.vocab.WordTombstoneRepository;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "spring.jpa.properties.hibernate.generate_statistics=true"
})
@AutoConfigureMockMvc
class Audit005CapacityTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private VocabularyRepository words;

    @Autowired
    private WordTombstoneRepository tombstones;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void snapshotCapacityBaselineRecordsPayloadAndQueryGrowth() throws Exception {
        for (int wordCount : List.of(100, 1_000, 5_000)) {
            String email = "aud005-snapshot-" + wordCount + "@example.com";
            seedWords(email, wordCount, Math.max(5, wordCount / 20));

            StatisticsSnapshot stats = measureGet(email, "/api/snapshot");
            JsonNode response = objectMapper.readTree(stats.responseBody());

            assertThat(response.path("vocab").size()).isEqualTo(wordCount);
            assertThat(response.path("tombstones").size()).isEqualTo(Math.max(5, wordCount / 20));
            assertThat(stats.queryCount()).isLessThanOrEqualTo(25);
            logMetric("snapshot", wordCount, response.path("tombstones").size(), stats);
        }
    }

    @Test
    void syncPushManyWordsRecordsRequestAndResponseSizeAndQueryCeiling() throws Exception {
        String email = "aud005-sync-many@example.com";
        seedWords(email, 1_000, 20);

        AppUser user = users.findByEmailIgnoreCase(email).orElseThrow();
        List<Map<String, Object>> vocab = words.findByUserOrderByCreatedAtDesc(user).stream()
                .limit(100)
                .map(word -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("wordUid", word.getWordUid().toString());
                    item.put("eng", word.getEng());
                    item.put("vie", word.getVie());
                    item.put("pos", word.getPos());
                    item.put("tag", word.getTag());
                    item.put("level", word.getLevel());
                    item.put("favorite", word.isFavorite());
                    return item;
                })
                .toList();

        StatisticsSnapshot stats = measurePost(email, "/api/sync", Map.of(
                "syncContractVersion", 2,
                "expectedRevision", 1,
                "vocab", vocab,
                "deletions", List.of(),
                "wrongWords", List.of()
        ));
        JsonNode response = objectMapper.readTree(stats.responseBody());

        assertThat(response.path("vocab").size()).isEqualTo(1_000);
        assertThat(stats.requestBytes()).isGreaterThan(0);
        assertThat(stats.queryCount()).isLessThanOrEqualTo(275);
        logMetric("sync-submit-100", 1_000, 20, stats);
    }

    @Test
    void quizSubmitManyAnswersHasMeasuredQueryCeiling() throws Exception {
        String email = "aud005-quiz-many@example.com";
        seedWords(email, 1_000, 20);

        List<Map<String, Object>> answers = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            answers.add(Map.of(
                    "eng", "aud word " + i,
                    "questionMode", "eng",
                    "selectedAnswer", i % 3 == 0 ? "wrong answer" : "nghia " + i,
                    "correctAnswer", "nghia " + i,
                    "correct", i % 3 != 0
            ));
        }

        StatisticsSnapshot stats = measurePost(email, "/api/quiz-results", Map.of(
                "quizMode", "mixed",
                "totalQuestions", answers.size(),
                "correctAnswers", 0,
                "wrongAnswers", 0,
                "score", 0,
                "maxCombo", 0,
                "answers", answers
        ));
        JsonNode response = objectMapper.readTree(stats.responseBody());

        assertThat(response.path("quizHistory").size()).isEqualTo(1);
        assertThat(stats.queryCount()).isLessThanOrEqualTo(350);
        logMetric("quiz-submit-100", 1_000, 20, stats);
    }

    @Test
    void reviewAndAnalyticsCapacityBaselineRecordsQueryCost() throws Exception {
        String email = "aud005-review-analytics@example.com";
        seedWords(email, 1_000, 20);

        StatisticsSnapshot reviewStats = measureGet(email, "/api/review/queue?limit=20");
        JsonNode reviewResponse = objectMapper.readTree(reviewStats.responseBody());
        assertThat(reviewResponse.size()).isEqualTo(20);
        assertThat(reviewStats.queryCount()).isLessThanOrEqualTo(20);
        logMetric("review-queue-limit-20", 1_000, 20, reviewStats);

        StatisticsSnapshot overviewStats = measureGet(email, "/api/analytics/overview");
        JsonNode overviewResponse = objectMapper.readTree(overviewStats.responseBody());
        assertThat(overviewResponse.path("totalWords").asInt()).isEqualTo(1_000);
        assertThat(overviewStats.queryCount()).isLessThanOrEqualTo(20);
        logMetric("analytics-overview", 1_000, 20, overviewStats);

        StatisticsSnapshot tagStats = measureGet(email, "/api/analytics/tag-performance");
        JsonNode tagResponse = objectMapper.readTree(tagStats.responseBody());
        assertThat(tagResponse.path("tags").size()).isGreaterThan(0);
        assertThat(tagStats.queryCount()).isLessThanOrEqualTo(20);
        logMetric("analytics-tag-performance", 1_000, 20, tagStats);
    }

    private StatisticsSnapshot measureGet(String email, String path) throws Exception {
        Statistics statistics = statistics();
        statistics.clear();
        long heapBefore = usedHeap();
        long started = System.nanoTime();
        MvcResult result = mockMvc.perform(get(path).with(oauthUser(email)))
                .andExpect(status().isOk())
                .andReturn();
        return snapshot(result, statistics, started, heapBefore, 0);
    }

    private StatisticsSnapshot measurePost(String email, String path, Map<String, Object> request) throws Exception {
        String requestBody = objectMapper.writeValueAsString(request);
        Statistics statistics = statistics();
        statistics.clear();
        long heapBefore = usedHeap();
        long started = System.nanoTime();
        MvcResult result = mockMvc.perform(post(path)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andReturn();
        return snapshot(
                result,
                statistics,
                started,
                heapBefore,
                requestBody.getBytes(java.nio.charset.StandardCharsets.UTF_8).length
        );
    }

    private StatisticsSnapshot snapshot(
            MvcResult result,
            Statistics statistics,
            long started,
            long heapBefore,
            int requestBytes
    ) throws Exception {
        String body = result.getResponse().getContentAsString();
        return new StatisticsSnapshot(
                statistics.getPrepareStatementCount(),
                Duration.ofNanos(System.nanoTime() - started).toMillis(),
                requestBytes,
                body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length,
                Math.max(0, usedHeap() - heapBefore) / 1024,
                body
        );
    }

    private void seedWords(String email, int wordCount, int tombstoneCount) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            AppUser user = new AppUser();
            user.setEmail(email);
            user.setGoogleSubject("sub-" + email);
            user.setDisplayName("AUD005 User");
            user.setSyncRevision(1);
            users.save(user);

            List<VocabularyWord> batch = new ArrayList<>(wordCount);
            Instant now = Instant.now();
            for (int i = 0; i < wordCount; i++) {
                VocabularyWord word = new VocabularyWord();
                word.setUser(user);
                word.setWordUid(UUID.randomUUID());
                word.setEng("aud word " + i);
                word.setVie("nghia " + i);
                word.setPos("n");
                word.setTag(i % 2 == 0 ? "review" : "general");
                word.setLevel(i % 3 == 0 ? "B1" : "A2");
                word.setMastered(i % 10 == 0);
                WordStats stats = new WordStats();
                stats.setSeen(i % 7);
                stats.setCorrect(i % 5);
                stats.setWrong(i % 4);
                stats.setCurrentStreak(i % 3);
                stats.setBestStreak(i % 5);
                stats.setMasteryLevel(i % 6);
                stats.setNextReview(i % 2 == 0 ? now.minus(Duration.ofDays(i % 30 + 1)) : now.plus(Duration.ofDays(7)));
                word.setStats(stats);
                batch.add(word);
            }
            words.saveAll(batch);

            List<WordTombstone> deleted = new ArrayList<>(tombstoneCount);
            for (int i = 0; i < tombstoneCount; i++) {
                WordTombstone tombstone = new WordTombstone();
                tombstone.setUser(user);
                tombstone.setWordUid(UUID.randomUUID());
                tombstone.setLegacyWordId(null);
                tombstone.setDeletedAt(now.minus(Duration.ofDays(i + 1)));
                tombstone.setDeletedRevision(i + 2L);
                deleted.add(tombstone);
            }
            tombstones.saveAll(deleted);
        });
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    private long usedHeap() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }

    private void logMetric(String operation, int words, int tombstones, StatisticsSnapshot stats) {
        System.out.printf(
                "AUD005_METRIC operation=%s words=%d tombstones=%d queries=%d millis=%d requestBytes=%d responseBytes=%d heapKb=%d%n",
                operation,
                words,
                tombstones,
                stats.queryCount(),
                stats.elapsedMillis(),
                stats.requestBytes(),
                stats.responseBytes(),
                stats.heapDeltaKb()
        );
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "AUD005 User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }

    private record StatisticsSnapshot(
            long queryCount,
            long elapsedMillis,
            int requestBytes,
            int responseBytes,
            long heapDeltaKb,
            String responseBody
    ) {
    }
}
