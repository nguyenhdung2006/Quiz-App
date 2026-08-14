package com.quizapp.review;

import com.quizapp.health.HealthCounterService;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SpacedRepetitionService {
    private static final Logger log = LoggerFactory.getLogger(SpacedRepetitionService.class);
    private static final int MAX_SAFE_COUNT = 1_000_000;

    private final VocabularyRepository words;
    private final AppUserRepository users;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    @Autowired
    public SpacedRepetitionService(VocabularyRepository words, AppUserRepository users) {
        this.words = words;
        this.users = users;
    }

    public SpacedRepetitionService(VocabularyRepository words) {
        this(words, null);
    }

    @Transactional(readOnly = true)
    public List<ReviewQueueItemDto> today(AppUser user) {
        return queue(user, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<ReviewQueueItemDto> queue(AppUser user, Integer limit, String tag, String level) {
        return words.findDueForReview(user, Instant.now(), normalizeFilter(tag), normalizeFilter(level)).stream()
                .map(this::toQueueItem)
                .sorted(Comparator.comparingInt(ReviewQueueItemDto::priority).reversed())
                .limit(limit == null || limit <= 0 ? Long.MAX_VALUE : limit)
                .toList();
    }

    @Transactional
    public ReviewAnswerResponse answer(AppUser user, ReviewAnswerRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        VocabularyWord word = words.findByIdAndUser(request.wordId(), syncUser)
                .orElseThrow(() -> {
                    log.warn("[REVIEW] Invalid review payload - word not found userId={} wordId={}",
                            syncUser.getId(), request.wordId());
                    if (healthCounters != null) healthCounters.incrementReviewFailures();
                    return new IllegalArgumentException("Word not found.");
                });
        WordStats stats = applyAnswer(word, request.correct(), Instant.now());
        words.save(word);
        syncUser.incrementSyncRevision();
        log.info("[REVIEW] Answer processed userId={} wordId={} correct={} mastery={}% streak={}",
                syncUser.getId(), word.getId(), request.correct(),
                masteryPercent(stats), stats.getCurrentStreak());
        return new ReviewAnswerResponse(
                word.getId(),
                masteryPercent(stats),
                stats.getCurrentStreak(),
                stats.getNextReview(),
                message(stats, request.correct())
        );
    }

    public WordStats applyAnswer(VocabularyWord word, boolean correct, Instant reviewedAt) {
        WordStats stats = ensureStats(word);
        Instant safeReviewedAt = safeReviewedAt(reviewedAt);
        sanitizeStats(stats);

        stats.setSeen(increment(stats.getSeen()));
        stats.setLastReviewed(safeReviewedAt);

        if (correct) {
            stats.setCorrect(increment(stats.getCorrect()));
            stats.setCurrentStreak(increment(stats.getCurrentStreak()));
            stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
            stats.setMasteryLevel(Math.min(5, stats.getMasteryLevel() + 1));
        } else {
            stats.setWrong(increment(stats.getWrong()));
            stats.setCurrentStreak(0);
            stats.setMasteryLevel(Math.max(0, stats.getMasteryLevel() - 1));
            word.setMastered(false);
        }

        if (stats.getCurrentStreak() >= 5) {
            word.setMastered(true);
            stats.setMasteryLevel(5);
        }

        stats.setNextReview(nextReview(stats, correct, safeReviewedAt));
        return stats;
    }

    public Instant nextReview(WordStats stats, boolean correct, Instant reviewedAt) {
        Instant safeReviewedAt = safeReviewedAt(reviewedAt);
        if (!correct) {
            return safeReviewedAt.plus(Duration.ofDays(1));
        }

        int streak = stats == null ? 0 : safeCount(stats.getCurrentStreak());
        int days = switch (Math.min(streak, 5)) {
            case 0, 1 -> 1;
            case 2 -> 3;
            case 3 -> 7;
            case 4 -> 14;
            default -> 30;
        };
        return safeReviewedAt.plus(Duration.ofDays(days));
    }

    private ReviewQueueItemDto toQueueItem(VocabularyWord word) {
        WordStats stats = ensureStats(word);
        return new ReviewQueueItemDto(
                word.getId(),
                word.getEng(),
                word.getVie(),
                blankFallback(word.getTag(), "untagged"),
                blankFallback(word.getLevel(), "unknown"),
                masteryPercent(stats),
                safeCount(stats.getCurrentStreak()),
                safeCount(stats.getWrong()),
                stats.getNextReview(),
                priority(word),
                reason(word)
        );
    }

    private int priority(VocabularyWord word) {
        WordStats stats = ensureStats(word);
        long overdueDays = stats.getNextReview() == null
                ? 0
                : Math.max(0, ChronoUnit.DAYS.between(stats.getNextReview(), Instant.now()));
        int lowMastery = 100 - masteryPercent(stats);
        int wrongPressure = Math.min(30, safeCount(stats.getWrong()) * 6);
        int overduePressure = (int) Math.min(30, overdueDays * 5);
        return Math.max(0, Math.min(100, lowMastery + wrongPressure + overduePressure));
    }

    private String reason(VocabularyWord word) {
        WordStats stats = ensureStats(word);
        boolean overdue = stats.getNextReview() != null && stats.getNextReview().isBefore(Instant.now().minus(Duration.ofDays(1)));
        if (overdue && masteryPercent(stats) < 60) return "Overdue and low mastery";
        if (overdue) return "Overdue review";
        if (safeCount(stats.getWrong()) >= 3) return "High wrong count";
        if (masteryPercent(stats) < 60) return "Low mastery";
        return "Due today";
    }

    private int masteryPercent(WordStats stats) {
        return Math.max(0, Math.min(100, safeMastery(stats.getMasteryLevel()) * 20));
    }

    private WordStats ensureStats(VocabularyWord word) {
        WordStats stats = word.getStats();
        if (stats == null) {
            stats = new WordStats();
            word.setStats(stats);
        }
        return stats;
    }

    private String message(WordStats stats, boolean correct) {
        if (!correct) {
            return "Review this word again tomorrow.";
        }
        return switch (Math.min(safeCount(stats.getCurrentStreak()), 5)) {
            case 0, 1 -> "Good job. Review again in 1 day.";
            case 2 -> "Good job. Review again in 3 days.";
            case 3 -> "Good job. Review again in 7 days.";
            case 4 -> "Good job. Review again in 14 days.";
            default -> "Great work. Review again in 30 days.";
        };
    }

    private String normalizeFilter(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String blankFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private void sanitizeStats(WordStats stats) {
        stats.setSeen(safeCount(stats.getSeen()));
        stats.setCorrect(safeCount(stats.getCorrect()));
        stats.setWrong(safeCount(stats.getWrong()));
        stats.setCurrentStreak(safeCount(stats.getCurrentStreak()));
        stats.setBestStreak(Math.max(safeCount(stats.getBestStreak()), stats.getCurrentStreak()));
        stats.setMasteryLevel(safeMastery(stats.getMasteryLevel()));
    }

    private int increment(int value) {
        return Math.min(MAX_SAFE_COUNT, safeCount(value) + 1);
    }

    private int safeCount(int value) {
        return Math.max(0, Math.min(MAX_SAFE_COUNT, value));
    }

    private int safeMastery(int value) {
        return Math.max(0, Math.min(5, value));
    }

    private Instant safeReviewedAt(Instant reviewedAt) {
        return reviewedAt == null ? Instant.now() : reviewedAt;
    }

    private AppUser lockUserForRevision(AppUser user) {
        if (user == null || user.getId() == null) {
            throw new IllegalStateException("Authentication is required.");
        }
        return users.findByIdForSyncUpdate(user.getId())
                .orElseThrow(() -> new IllegalStateException("User not found."));
    }
}
