package com.quizapp.quiz;

public record QuizAttemptOutcomeDto(
        Long quizHistoryId,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        double score,
        int maxCombo,
        int awardedQuizXp,
        int awardedAchievementXp,
        long resultingSyncRevision
) {
}
