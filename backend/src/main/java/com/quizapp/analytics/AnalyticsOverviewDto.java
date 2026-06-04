package com.quizapp.analytics;

import java.util.List;

public record AnalyticsOverviewDto(
        int totalWords,
        int masteredWords,
        int learningWords,
        int strugglingWords,
        long dueToday,
        int averageAccuracy,
        long totalQuizSessions,
        int currentStreak,
        int xp,
        int weeklyXp,
        List<LearningInsightDto> insights
) {
}
