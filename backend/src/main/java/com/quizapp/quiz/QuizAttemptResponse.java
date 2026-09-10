package com.quizapp.quiz;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record QuizAttemptResponse(
        UUID attemptId,
        String quizMode,
        Integer challengeSeconds,
        Instant createdAt,
        Instant expiresAt,
        List<QuizAttemptItemResponse> items
) {
}
