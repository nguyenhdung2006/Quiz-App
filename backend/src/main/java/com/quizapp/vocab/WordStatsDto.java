package com.quizapp.vocab;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PastOrPresent;
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
}
