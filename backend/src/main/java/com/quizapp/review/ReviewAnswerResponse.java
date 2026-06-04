package com.quizapp.review;

import java.time.Instant;

public record ReviewAnswerResponse(
        Long wordId,
        int mastery,
        int streak,
        Instant nextReview,
        String message
) {
}
