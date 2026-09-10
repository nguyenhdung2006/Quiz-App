package com.quizapp.analytics;

import com.quizapp.health.HealthCounterService;
import com.quizapp.user.AppUser;
import com.quizapp.vocab.QuizHistory;
import com.quizapp.vocab.QuizHistoryRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LearningAnalyticsService {
    private static final Logger log = LoggerFactory.getLogger(LearningAnalyticsService.class);
    private static final int MAX_SAFE_COUNT = 1_000_000;
    private final VocabularyRepository words;
    private final QuizHistoryRepository quizHistory;
    private final LearningInsightService insights;
    private final AnalyticsTimeProvider time;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    public LearningAnalyticsService(
            VocabularyRepository words,
            QuizHistoryRepository quizHistory,
            LearningInsightService insights,
            AnalyticsTimeProvider time
    ) {
        this.words = words;
        this.quizHistory = quizHistory;
        this.insights = insights;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public AnalyticsOverviewDto overview(AppUser user) {
        log.info("[ANALYTICS] Generating overview userId={}", user.getId());
        try {
            Instant now = time.now();
            List<VocabularyWord> userWords = userWords(user);
            List<QuizHistory> histories = histories(user);
            ReviewPressureDto pressure = reviewPressure(userWords, now);
            List<AccuracyTrendDto> trend = accuracyTrend(histories);
            TagPerformanceDto performance = tagPerformance(userWords, histories);

            int mastered = (int) userWords.stream().filter(this::isMastered).count();
            int struggling = (int) userWords.stream().filter(this::isStruggling).count();
            int learning = (int) userWords.stream()
                    .filter(word -> !isMastered(word) && !isStruggling(word))
                    .count();
            int weeklyXp = histories.stream()
                    .filter(history -> history.getCreatedAt() != null)
                    .filter(history -> !history.getCreatedAt().isBefore(now.minus(java.time.Duration.ofDays(7))))
                    .mapToInt(this::quizXp)
                    .sum();

            AnalyticsOverviewDto base = new AnalyticsOverviewDto(
                    userWords.size(),
                    mastered,
                    learning,
                    struggling,
                    pressure.dueToday(),
                    averageWordAccuracy(userWords),
                    histories.size(),
                    user.getStreak(),
                    user.getXp(),
                    weeklyXp,
                    List.of()
            );

            AnalyticsOverviewDto result = new AnalyticsOverviewDto(
                    base.totalWords(),
                    base.masteredWords(),
                    base.learningWords(),
                    base.strugglingWords(),
                    base.dueToday(),
                    base.averageAccuracy(),
                    base.totalQuizSessions(),
                    base.currentStreak(),
                    base.xp(),
                    base.weeklyXp(),
                    insights.generate(base, trend, pressure, performance)
            );

            log.info("[ANALYTICS] Overview generated userId={} totalWords={} mastered={} learning={} struggling={}",
                    user.getId(), result.totalWords(), result.masteredWords(), result.learningWords(), result.strugglingWords());
            return result;
        } catch (RuntimeException ex) {
            log.warn("[ANALYTICS] Overview generation failed userId={} type={} message={}",
                    user.getId(), ex.getClass().getSimpleName(), ex.getMessage());
            if (healthCounters != null) healthCounters.incrementAnalyticsFailures();
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<AccuracyTrendDto> accuracyTrend(AppUser user) {
        return accuracyTrend(histories(user));
    }

    private List<AccuracyTrendDto> accuracyTrend(List<QuizHistory> histories) {
        Map<LocalDate, QuizDayAccumulator> byDay = new TreeMap<>();
        for (QuizHistory history : histories) {
            if (history.getCreatedAt() == null) continue;
            byDay.computeIfAbsent(toDate(history.getCreatedAt()), ignored -> new QuizDayAccumulator())
                    .add(history);
        }

        return byDay.entrySet().stream()
                .map(entry -> new AccuracyTrendDto(
                        entry.getKey(),
                        accuracy(entry.getValue().correct, entry.getValue().total),
                        entry.getValue().quizCount
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<WeakWordDto> weakWords(AppUser user) {
        return userWords(user).stream()
                .filter(word -> reviewCount(word) > 0)
                .filter(word -> accuracy(word) < 70 || wrongCount(word) >= 3)
                .sorted(Comparator.comparingDouble(this::weaknessScore).reversed())
                .limit(10)
                .map(word -> new WeakWordDto(
                        word.getEng(),
                        accuracy(word),
                        wrongCount(word),
                        reviewCount(word),
                        label(word.getTag(), "untagged"),
                        label(word.getLevel(), "unknown")
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public ReviewPressureDto reviewPressure(AppUser user) {
        return reviewPressure(userWords(user), time.now());
    }

    private ReviewPressureDto reviewPressure(List<VocabularyWord> userWords, Instant now) {
        LocalDate today = time.toDate(now);
        long dueToday = userWords.stream().filter(word -> isDue(word, now)).count();
        long overdue = userWords.stream().filter(word -> isOverdue(word, today)).count();
        long mastered = userWords.stream().filter(this::isMastered).count();
        long struggling = userWords.stream().filter(this::isStruggling).count();
        long learning = userWords.stream()
                .filter(word -> !isMastered(word) && !isStruggling(word))
                .count();

        return new ReviewPressureDto(dueToday, overdue, mastered, learning, struggling);
    }

    @Transactional(readOnly = true)
    public TagPerformanceDto tagPerformance(AppUser user) {
        return tagPerformance(userWords(user), histories(user));
    }

    private TagPerformanceDto tagPerformance(
            List<VocabularyWord> userWords,
            List<QuizHistory> histories
    ) {
        return new TagPerformanceDto(
                wordPerformance(userWords, word -> label(word.getTag(), "untagged")),
                wordPerformance(userWords, word -> label(word.getLevel(), "unknown")),
                quizModePerformance(histories)
        );
    }

    private List<VocabularyWord> userWords(AppUser user) {
        return words.findByUserOrderByCreatedAtDesc(user);
    }

    private List<QuizHistory> histories(AppUser user) {
        return quizHistory.findByUserOrderByCreatedAtDesc(user);
    }

    private List<PerformanceMetricDto> wordPerformance(
            List<VocabularyWord> userWords,
            java.util.function.Function<VocabularyWord, String> classifier
    ) {
        Map<String, WordAccumulator> grouped = new LinkedHashMap<>();
        for (VocabularyWord word : userWords) {
            grouped.computeIfAbsent(classifier.apply(word), ignored -> new WordAccumulator()).add(word);
        }

        return grouped.entrySet().stream()
                .map(entry -> new PerformanceMetricDto(
                        entry.getKey(),
                        accuracy(entry.getValue().correct, entry.getValue().reviewCount),
                        entry.getValue().wordCount,
                        entry.getValue().reviewCount
                ))
                .sorted(Comparator.comparingLong(PerformanceMetricDto::reviewCount).reversed())
                .toList();
    }

    private List<PerformanceMetricDto> quizModePerformance(List<QuizHistory> histories) {
        return histories.stream()
                .collect(Collectors.groupingBy(
                        history -> label(history.getQuizMode(), "mixed"),
                        LinkedHashMap::new,
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> {
                    int total = entry.getValue().stream().mapToInt(QuizHistory::getTotalQuestions).sum();
                    int correct = entry.getValue().stream().mapToInt(QuizHistory::getCorrectAnswers).sum();
                    return new PerformanceMetricDto(
                            entry.getKey(),
                            accuracy(correct, total),
                            entry.getValue().size(),
                            total
                    );
                })
                .sorted(Comparator.comparingLong(PerformanceMetricDto::reviewCount).reversed())
                .toList();
    }

    private int averageWordAccuracy(List<VocabularyWord> userWords) {
        int total = userWords.stream().mapToInt(this::reviewCount).sum();
        int correct = userWords.stream().mapToInt(this::correctCount).sum();
        return accuracy(correct, total);
    }

    private int accuracy(VocabularyWord word) {
        return accuracy(correctCount(word), reviewCount(word));
    }

    private int accuracy(int correct, long total) {
        if (total <= 0) return 0;
        long safeTotal = Math.min(MAX_SAFE_COUNT, total);
        int safeCorrect = Math.max(0, Math.min(correct, (int) safeTotal));
        return Math.max(0, Math.min(100, (int) Math.round(safeCorrect * 100.0 / safeTotal)));
    }

    private int correctCount(VocabularyWord word) {
        WordStats stats = word.getStats();
        return stats == null ? 0 : safeCount(stats.getCorrect());
    }

    private int wrongCount(VocabularyWord word) {
        WordStats stats = word.getStats();
        return stats == null ? 0 : safeCount(stats.getWrong());
    }

    private int reviewCount(VocabularyWord word) {
        WordStats stats = word.getStats();
        if (stats == null) return 0;
        return Math.max(safeCount(stats.getSeen()), safeCount(stats.getCorrect()) + safeCount(stats.getWrong()));
    }

    private boolean isMastered(VocabularyWord word) {
        WordStats stats = word.getStats();
        return word.isMastered() || (stats != null && stats.getMasteryLevel() >= 5);
    }

    private boolean isStruggling(VocabularyWord word) {
        return reviewCount(word) >= 3 && wrongCount(word) >= 2 && accuracy(word) < 60;
    }

    private boolean isDue(VocabularyWord word, Instant now) {
        WordStats stats = word.getStats();
        return stats != null && stats.getNextReview() != null && !stats.getNextReview().isAfter(now);
    }

    private boolean isOverdue(VocabularyWord word, LocalDate today) {
        WordStats stats = word.getStats();
        if (stats == null || stats.getNextReview() == null) return false;
        return toDate(stats.getNextReview()).isBefore(today);
    }

    private double weaknessScore(VocabularyWord word) {
        return wrongCount(word) * 3.0 + reviewCount(word) * ((100 - accuracy(word)) / 100.0);
    }

    private int quizXp(QuizHistory history) {
        return Math.max(0,
                history.getCorrectAnswers() * 12
                        + history.getTotalQuestions() * 3
                        + history.getMaxCombo());
    }

    private LocalDate toDate(Instant instant) {
        return time.toDate(instant);
    }

    private String label(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private int safeCount(int value) {
        return Math.max(0, Math.min(MAX_SAFE_COUNT, value));
    }

    private static class WordAccumulator {
        int wordCount;
        int correct;
        int reviewCount;

        void add(VocabularyWord word) {
            WordStats stats = word.getStats();
            wordCount++;
            if (stats == null) return;
            correct += Math.max(0, Math.min(MAX_SAFE_COUNT, stats.getCorrect()));
            reviewCount += Math.max(
                    Math.max(0, Math.min(MAX_SAFE_COUNT, stats.getSeen())),
                    Math.max(0, Math.min(MAX_SAFE_COUNT, stats.getCorrect()))
                            + Math.max(0, Math.min(MAX_SAFE_COUNT, stats.getWrong()))
            );
        }
    }

    private static class QuizDayAccumulator {
        int total;
        int correct;
        long quizCount;

        void add(QuizHistory history) {
            int safeTotal = Math.max(0, Math.min(MAX_SAFE_COUNT, history.getTotalQuestions()));
            total += safeTotal;
            correct += Math.max(0, Math.min(history.getCorrectAnswers(), safeTotal));
            quizCount++;
        }
    }
}
