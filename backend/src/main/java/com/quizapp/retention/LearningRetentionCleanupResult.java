package com.quizapp.retention;

public record LearningRetentionCleanupResult(
        int selectedConsumedAttempts,
        int deletedConsumedAttempts,
        int selectedExpiredIssuedAttempts,
        int deletedExpiredIssuedAttempts,
        int selectedReviewOperations,
        int deletedReviewOperations,
        long durationMillis
) {
}
