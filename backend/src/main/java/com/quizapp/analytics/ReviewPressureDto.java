package com.quizapp.analytics;

public record ReviewPressureDto(
        long dueToday,
        long overdue,
        long mastered,
        long learning,
        long struggling
) {
}
