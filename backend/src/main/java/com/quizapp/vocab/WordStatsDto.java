package com.quizapp.vocab;

import java.time.Instant;

public record WordStatsDto(
        int seen,
        int correct,
        int wrong,
        int streak,
        int bestStreak,
        int masteryLevel,
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
