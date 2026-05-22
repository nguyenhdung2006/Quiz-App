package com.quizapp.vocab;

public record WordStatsDto(
        int seen,
        int correct,
        int wrong,
        int streak,
        int bestStreak
) {
    public static WordStatsDto from(WordStats stats) {
        if (stats == null) return new WordStatsDto(0, 0, 0, 0, 0);
        return new WordStatsDto(
                stats.getSeen(),
                stats.getCorrect(),
                stats.getWrong(),
                stats.getCurrentStreak(),
                stats.getBestStreak()
        );
    }
}
