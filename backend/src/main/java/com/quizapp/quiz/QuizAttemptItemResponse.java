package com.quizapp.quiz;

import java.util.UUID;

public record QuizAttemptItemResponse(
        int ordinal,
        Long wordId,
        UUID wordUid,
        String questionMode,
        String prompt
) {
}
