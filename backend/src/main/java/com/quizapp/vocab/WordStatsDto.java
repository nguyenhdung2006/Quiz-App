package com.quizapp.vocab;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PastOrPresent;
import java.time.Duration;
import java.time.Instant;

public record WordStatsDto(
        @Min(value = 0, message = "Seen count cannot be negative.")
        int seen,

        @Min(value = 0, message = "Correct count cannot be negative.")
        int correct,

        @Min(value = 0, message = "Wrong count cannot be negative.")
        int wrong,

        @Min(value = 0, message = "Current streak cannot be negative.")
        int streak,

        @Min(value = 0, message = "Best streak cannot be negative.")
        int bestStreak,

        @Min(value = 0, message = "Mastery level must be between 0 and 5.")
        @Max(value = 5, message = "Mastery level must be between 0 and 5.")
        int masteryLevel,

        @PastOrPresent(message = "Last reviewed cannot be in the future.")
        Instant lastReviewed,

        Instant nextReview
) {
    private static final int MAX_SAFE_COUNT = 1_000_000;
    private static final Instant MIN_SAFE_INSTANT = Instant.parse("2000-01-01T00:00:00Z");
    private static final Duration MAX_REVIEW_FUTURE = Duration.ofDays(370);

    public WordStatsDto {
        seen = clamp(seen, 0, MAX_SAFE_COUNT);
        correct = clamp(correct, 0, MAX_SAFE_COUNT);
        wrong = clamp(wrong, 0, MAX_SAFE_COUNT);
        streak = clamp(streak, 0, MAX_SAFE_COUNT);
        bestStreak = Math.max(clamp(bestStreak, 0, MAX_SAFE_COUNT), streak);
        masteryLevel = clamp(masteryLevel, 0, 5);
        lastReviewed = safePastInstant(lastReviewed);
        nextReview = safeReviewInstant(nextReview);
    }

    public static WordStatsDto from(WordStats stats) {
        if (stats == null) return new WordStatsDto(0, 0, 0, 0, 0, 0, null, null);
        return new WordStatsDto(
                stats.getSeen(),
                stats.getCorrect(),
                stats.getWrong(),
                stats.getCurrentStreak(),
                stats.getBestStreak(),
                stats.getMasteryLevel(),
                stats.getLastReviewed(),
                stats.getNextReview()
        );
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static Instant safePastInstant(Instant value) {
        if (value == null || value.isBefore(MIN_SAFE_INSTANT) || value.isAfter(Instant.now())) return null;
        return value;
    }

    private static Instant safeReviewInstant(Instant value) {
        if (value == null || value.isBefore(MIN_SAFE_INSTANT)) return null;
        if (value.isAfter(Instant.now().plus(MAX_REVIEW_FUTURE))) return null;
        return value;
    }
}
