package com.quizapp.analytics;

public record WeakWordDto(
        String word,
        int accuracy,
        int wrongCount,
        int reviewCount,
        String tag,
        String level
) {
}
