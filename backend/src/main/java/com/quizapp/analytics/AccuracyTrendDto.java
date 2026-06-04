package com.quizapp.analytics;

import java.time.LocalDate;

public record AccuracyTrendDto(
        LocalDate date,
        int accuracy,
        long quizCount
) {
}
