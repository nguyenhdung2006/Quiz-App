package com.quizapp.review;

import java.time.Instant;

public record ReviewQueueItemDto(
        Long wordId,
        String eng,
        String vie,
        String tag,
        String level,
        int mastery,
        int streak,
        int wrongCount,
        Instant nextReview,
        int priority,
        String reason
) {
}
