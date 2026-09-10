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
import com.quizapp.vocab.Achievement;
import com.quizapp.vocab.AchievementRepository;
import com.quizapp.vocab.QuizHistory;
import com.quizapp.vocab.QuizHistoryRepository;
import com.quizapp.vocab.UserAchievement;
import com.quizapp.vocab.UserAchievementId;
import com.quizapp.vocab.UserAchievementRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import com.quizapp.vocab.WordTombstone;
import com.quizapp.vocab.WordTombstoneRepository;
import com.quizapp.vocab.WrongBankEntry;
import com.quizapp.vocab.WrongBankRepository;
import jakarta.persistence.EntityManagerFactory;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "spring.datasource.url=jdbc:h2:mem:finding10benchmark;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.stat=OFF"
})
@AutoConfigureMockMvc
@EnabledIfSystemProperty(named = "finding10.phase", matches = ".+")
class Finding10PerformanceBenchmark {
    private static final List<Integer> DATASET_SIZES = List.of(100, 1_000, 10_000);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private VocabularyRepository words;

    @Autowired
    private WrongBankRepository wrongBank;

    @Autowired
    private WordTombstoneRepository tombstones;

    @Autowired
    private QuizHistoryRepository quizHistory;

    @Autowired
    private AchievementRepository achievements;

    @Autowired
    private UserAchievementRepository userAchievements;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void benchmarkFindingTenFlowsAtRealisticLocalSizes() throws Exception {
        for (int wordCount : DATASET_SIZES) {
            Dataset dataset = seedDataset(wordCount);

            Measurement snapshot = measureGet(dataset.email(), "/api/snapshot");
            JsonNode snapshotBody = objectMapper.readTree(snapshot.responseBody());
            assertThat(snapshotBody.path("vocab").size()).isEqualTo(wordCount);
            assertThat(snapshotBody.path("wrongWords").size()).isEqualTo(dataset.wrongBankCount());
            assertThat(snapshotBody.path("tombstones").size()).isEqualTo(dataset.tombstoneCount());
            assertThat(snapshotBody.path("quizHistory").size()).isEqualTo(Math.min(10, dataset.historyCount()));
            assertThat(snapshot.queryCount()).isLessThanOrEqualTo(9);
            logMetric("snapshot", dataset, snapshot);

            Measurement progress = measureGet(dataset.email(), "/api/progress");
            JsonNode progressBody = objectMapper.readTree(progress.responseBody());
            assertThat(progressBody.path("totalQuizzes").asInt()).isEqualTo(dataset.historyCount());
            assertThat(progressBody.path("dueToday").asInt()).isEqualTo(wordCount);
            assertThat(progress.queryCount()).isLessThanOrEqualTo(5);
            assertThat(progress.entityLoadCount()).isLessThanOrEqualTo(2);
            logMetric("progress", dataset, progress);

            Measurement analytics = measureGet(dataset.email(), "/api/analytics/overview");
            JsonNode analyticsBody = objectMapper.readTree(analytics.responseBody());
            assertThat(analyticsBody.path("totalWords").asInt()).isEqualTo(wordCount);
            assertThat(analyticsBody.path("totalQuizSessions").asInt()).isEqualTo(dataset.historyCount());
            assertThat(analytics.queryCount()).isLessThanOrEqualTo(3);
            logMetric("analytics-overview", dataset, analytics);

            Measurement review = measureGet(dataset.email(), "/api/review/queue?limit=20");
            JsonNode reviewBody = objectMapper.readTree(review.responseBody());
            assertThat(reviewBody.size()).isEqualTo(20);
            assertThat(review.queryCount()).isLessThanOrEqualTo(2);
            assertThat(review.entityLoadCount()).isLessThanOrEqualTo(50);
            logMetric("review-limit-20", dataset, review);
        }
    }

    private Dataset seedDataset(int wordCount) {
        int tombstoneCount = Math.max(5, wordCount / 20);
        int wrongBankCount = Math.max(10, wordCount / 5);
        int historyCount = Math.max(10, wordCount / 10);
        String email = "finding10-" + wordCount + "@example.com";

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            AppUser user = new AppUser();
            user.setEmail(email);
            user.setGoogleSubject("sub-" + email);
            user.setDisplayName("Finding 10 Benchmark");
            user.setSyncRevision(1);
            users.save(user);

            Instant now = Instant.parse("2026-08-24T12:00:00Z");
            List<VocabularyWord> seededWords = new ArrayList<>(wordCount);
            for (int index = 0; index < wordCount; index++) {
                VocabularyWord word = new VocabularyWord();
                word.setUser(user);
                word.setWordUid(new UUID(wordCount, index + 1L));
                word.setEng("finding ten word " + index);
                word.setVie("meaning " + index);
                word.setPos("n");
                word.setTag(index % 2 == 0 ? "review" : "general");
                word.setLevel(index % 3 == 0 ? "B1" : "A2");
                word.setMastered(index % 10 == 0);

                WordStats stats = new WordStats();
                stats.setSeen(index % 8);
                stats.setCorrect(index % 6);
                stats.setWrong(index % 5);
                stats.setCurrentStreak(index % 5);
                stats.setBestStreak(index % 7);
                stats.setMasteryLevel(index % 6);
                stats.setNextReview(now.minus(Duration.ofDays(index % 7 + 1L)));
                word.setStats(stats);
                seededWords.add(word);
            }
            words.saveAll(seededWords);

            List<WrongBankEntry> wrongEntries = new ArrayList<>(wrongBankCount);
            for (int index = 0; index < wrongBankCount; index++) {
                WrongBankEntry entry = new WrongBankEntry();
                entry.setUser(user);
                entry.setWord(seededWords.get(index));
                entry.setMastered(seededWords.get(index).isMastered());
                wrongEntries.add(entry);
            }
            wrongBank.saveAll(wrongEntries);

            List<WordTombstone> deleted = new ArrayList<>(tombstoneCount);
            for (int index = 0; index < tombstoneCount; index++) {
                WordTombstone tombstone = new WordTombstone();
                tombstone.setUser(user);
                tombstone.setWordUid(new UUID(Long.MAX_VALUE - wordCount, index + 1L));
                tombstone.setDeletedAt(now.minus(Duration.ofDays(index + 1L)));
                tombstone.setDeletedRevision(index + 2L);
                deleted.add(tombstone);
            }
            tombstones.saveAll(deleted);

            List<QuizHistory> histories = new ArrayList<>(historyCount);
            for (int index = 0; index < historyCount; index++) {
                QuizHistory history = new QuizHistory();
                history.setUser(user);
                history.setQuizMode(index % 2 == 0 ? "mixed" : "review");
                history.setTotalQuestions(20);
                history.setCorrectAnswers(12 + index % 8);
                history.setWrongAnswers(8 - index % 8);
                history.setScore(6.0 + index % 5);
                history.setMaxCombo(index % 12);
                histories.add(history);
            }
            quizHistory.saveAll(histories);

            List<Achievement> catalog = achievementCatalog();
            List<UserAchievement> unlocked = new ArrayList<>(catalog.size());
            for (Achievement achievement : catalog) {
                UserAchievement userAchievement = new UserAchievement();
                userAchievement.setId(new UserAchievementId(user.getId(), achievement.getId()));
                userAchievement.setUser(user);
                userAchievement.setAchievement(achievement);
                unlocked.add(userAchievement);
            }
            userAchievements.saveAll(unlocked);
        });

        return new Dataset(email, wordCount, tombstoneCount, wrongBankCount, historyCount);
    }

    private List<Achievement> achievementCatalog() {
        List<Achievement> existing = achievements.findAll();
        if (!existing.isEmpty()) return existing;

        List<Achievement> created = new ArrayList<>();
        for (int index = 1; index <= 5; index++) {
            Achievement achievement = new Achievement();
            achievement.setCode("FINDING10_" + index);
            achievement.setName("Finding 10 Achievement " + index);
            achievement.setDescription("Deterministic benchmark achievement.");
            achievement.setXpReward(index);
            created.add(achievement);
        }
        return achievements.saveAll(created);
    }

    private Measurement measureGet(String email, String path) throws Exception {
        Statistics statistics = statistics();
        statistics.clear();
        long heapBefore = usedHeap();
        long started = System.nanoTime();
        MvcResult result = mockMvc.perform(get(path).with(oauthUser(email)))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        return new Measurement(
                statistics.getPrepareStatementCount(),
                statistics.getEntityLoadCount(),
                Duration.ofNanos(System.nanoTime() - started).toMillis(),
                body.getBytes(StandardCharsets.UTF_8).length,
                Math.max(0, usedHeap() - heapBefore) / 1024,
                body
        );
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    private long usedHeap() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }

    private void logMetric(String operation, Dataset dataset, Measurement measurement) {
        String phase = System.getProperty("finding10.phase", "baseline");
        System.out.printf(
                "FINDING10_METRIC phase=%s operation=%s words=%d tombstones=%d wrongBank=%d histories=%d queries=%d entities=%d millis=%d responseBytes=%d heapKb=%d%n",
                phase,
                operation,
                dataset.wordCount(),
                dataset.tombstoneCount(),
                dataset.wrongBankCount(),
                dataset.historyCount(),
                measurement.queryCount(),
                measurement.entityLoadCount(),
                measurement.elapsedMillis(),
                measurement.responseBytes(),
                measurement.heapDeltaKb()
        );
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Finding 10 Benchmark");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }

    private record Dataset(
            String email,
            int wordCount,
            int tombstoneCount,
            int wrongBankCount,
            int historyCount
    ) {
    }

    private record Measurement(
            long queryCount,
            long entityLoadCount,
            long elapsedMillis,
            int responseBytes,
            long heapDeltaKb,
            String responseBody
    ) {
    }
}
