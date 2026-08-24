package com.quizapp.review;

import com.quizapp.vocab.WordDto;
import java.time.Instant;

public record ReviewAnswerResponse(
        Long wordId,
        int mastery,
        int streak,
        Instant nextReview,
        String message,
        WordDto word
) {
}
