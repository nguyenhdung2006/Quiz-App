package com.quizapp.quiz;

import com.quizapp.vocab.SyncResponse;
import java.util.UUID;

public record QuizAttemptSubmitResponse(
        UUID attemptId,
        boolean replayed,
        QuizAttemptOutcomeDto outcome,
        SyncResponse snapshot
) {
}
