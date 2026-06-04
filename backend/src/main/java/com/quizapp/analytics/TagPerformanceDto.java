package com.quizapp.analytics;

import java.util.List;

public record TagPerformanceDto(
        List<PerformanceMetricDto> tags,
        List<PerformanceMetricDto> levels,
        List<PerformanceMetricDto> quizModes
) {
}
