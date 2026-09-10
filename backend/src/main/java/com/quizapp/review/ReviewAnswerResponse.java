package com.quizapp.review;

import com.quizapp.vocab.WordDto;

public record ReviewAnswerResponse(
        ReviewOperationOutcome outcome,
        boolean replayed,
        WordDto word,
        boolean inWrongBank,
        long revision
) {
}
