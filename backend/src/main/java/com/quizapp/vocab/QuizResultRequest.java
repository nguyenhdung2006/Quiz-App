package com.quizapp.vocab;

import java.util.List;

public record QuizResultRequest(
        String quizMode,
        Integer challengeSeconds,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        double score,
        int maxCombo,
        List<QuizAnswerRequest> answers
) {
}
