package com.quizapp.vocab;

import java.time.Instant;

public record QuizHistoryDto(
        Long id,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        double score,
        String quizMode,
        Integer challengeSeconds,
        int maxCombo,
        Instant createdAt
) {
    public static QuizHistoryDto from(QuizHistory history) {
        return new QuizHistoryDto(
                history.getId(),
                history.getTotalQuestions(),
                history.getCorrectAnswers(),
                history.getWrongAnswers(),
                history.getScore(),
                history.getQuizMode(),
                history.getChallengeSeconds(),
                history.getMaxCombo(),
                history.getCreatedAt()
        );
    }
}
