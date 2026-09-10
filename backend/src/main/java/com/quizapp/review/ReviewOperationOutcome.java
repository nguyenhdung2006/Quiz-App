package com.quizapp.review;

import java.time.Instant;
import java.util.UUID;

/** Immutable accepted result; the response's word and revision are current read models. */
public record ReviewOperationOutcome(UUID operationId, Long wordId, String action,
        int mastery, int streak, Instant nextReview, String message, long resultingRevision) {
}
