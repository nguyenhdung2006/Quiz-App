package com.quizapp.review;

import com.quizapp.user.AppUser;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SpacedRepetitionService {
    private final VocabularyRepository words;

    public SpacedRepetitionService(VocabularyRepository words) {
        this.words = words;
    }

    @Transactional(readOnly = true)
    public List<ReviewQueueItemDto> today(AppUser user) {
        return queue(user, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<ReviewQueueItemDto> queue(AppUser user, Integer limit, String tag, String level) {
        return words.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(this::isDue)
                .filter(word -> matches(tag, word.getTag()))
                .filter(word -> matches(level, word.getLevel()))
                .map(this::toQueueItem)
                .sorted(Comparator.comparingInt(ReviewQueueItemDto::priority).reversed())
                .limit(limit == null || limit <= 0 ? Long.MAX_VALUE : limit)
                .toList();
    }

    @Transactional
    public ReviewAnswerResponse answer(AppUser user, ReviewAnswerRequest request) {
        VocabularyWord word = words.findByIdAndUser(request.wordId(), user)
                .orElseThrow(() -> new IllegalArgumentException("Word not found."));
        WordStats stats = applyAnswer(word, request.correct(), Instant.now());
        words.save(word);
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
        stats.setSeen(stats.getSeen() + 1);
        stats.setLastReviewed(reviewedAt);

        if (correct) {
            stats.setCorrect(stats.getCorrect() + 1);
            stats.setCurrentStreak(stats.getCurrentStreak() + 1);
            stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
            stats.setMasteryLevel(Math.min(5, stats.getMasteryLevel() + 1));
        } else {
            stats.setWrong(stats.getWrong() + 1);
            stats.setCurrentStreak(0);
            stats.setMasteryLevel(Math.max(0, stats.getMasteryLevel() - 1));
            word.setMastered(false);
        }

        if (stats.getCurrentStreak() >= 5) {
            word.setMastered(true);
            stats.setMasteryLevel(5);
        }

        stats.setNextReview(nextReview(stats, correct, reviewedAt));
        return stats;
    }

    public Instant nextReview(WordStats stats, boolean correct, Instant reviewedAt) {
        if (!correct) {
            return reviewedAt.plus(Duration.ofDays(1));
        }

        int days = switch (Math.min(stats.getCurrentStreak(), 5)) {
            case 0, 1 -> 1;
            case 2 -> 3;
            case 3 -> 7;
            case 4 -> 14;
            default -> 30;
        };
        return reviewedAt.plus(Duration.ofDays(days));
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
                stats.getCurrentStreak(),
                stats.getWrong(),
                stats.getNextReview(),
                priority(word),
                reason(word)
        );
    }

    private boolean isDue(VocabularyWord word) {
        WordStats stats = word.getStats();
        return stats != null && stats.getNextReview() != null && !stats.getNextReview().isAfter(Instant.now());
    }

    private int priority(VocabularyWord word) {
        WordStats stats = ensureStats(word);
        long overdueDays = stats.getNextReview() == null
                ? 0
                : Math.max(0, ChronoUnit.DAYS.between(stats.getNextReview(), Instant.now()));
        int lowMastery = 100 - masteryPercent(stats);
        int wrongPressure = Math.min(30, stats.getWrong() * 6);
        int overduePressure = (int) Math.min(30, overdueDays * 5);
        return Math.max(0, Math.min(100, lowMastery + wrongPressure + overduePressure));
    }

    private String reason(VocabularyWord word) {
        WordStats stats = ensureStats(word);
        boolean overdue = stats.getNextReview() != null && stats.getNextReview().isBefore(Instant.now().minus(Duration.ofDays(1)));
        if (overdue && masteryPercent(stats) < 60) return "Overdue and low mastery";
        if (overdue) return "Overdue review";
        if (stats.getWrong() >= 3) return "High wrong count";
        if (masteryPercent(stats) < 60) return "Low mastery";
        return "Due today";
    }

    private int masteryPercent(WordStats stats) {
        return Math.max(0, Math.min(100, stats.getMasteryLevel() * 20));
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
        return switch (Math.min(stats.getCurrentStreak(), 5)) {
            case 0, 1 -> "Good job. Review again in 1 day.";
            case 2 -> "Good job. Review again in 3 days.";
            case 3 -> "Good job. Review again in 7 days.";
            case 4 -> "Good job. Review again in 14 days.";
            default -> "Great work. Review again in 30 days.";
        };
    }

    private boolean matches(String filter, String value) {
        return filter == null || filter.isBlank() || filter.equalsIgnoreCase(value == null ? "" : value);
    }

    private String blankFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
