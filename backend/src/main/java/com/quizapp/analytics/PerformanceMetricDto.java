package com.quizapp.analytics;

public record PerformanceMetricDto(
        String name,
        int accuracy,
        long itemCount,
        long reviewCount
) {
}
