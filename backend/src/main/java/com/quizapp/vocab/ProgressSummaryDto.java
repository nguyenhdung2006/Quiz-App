package com.quizapp.vocab;

public record ProgressSummaryDto(
        long totalQuizzes,
        long weeklyQuizzes,
        int weeklyCorrectAnswers,
        double weeklyAverageScore,
        long dueToday,
        int unlockedAchievements
) {
}
