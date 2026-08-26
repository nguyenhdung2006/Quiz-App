package com.quizapp.vocab;

public record AuthoritativeQuizResult(
        SyncResponse snapshot,
        QuizHistory history,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        double score,
        int maxCombo,
        int awardedQuizXp,
        long resultingRevision
) {
}
