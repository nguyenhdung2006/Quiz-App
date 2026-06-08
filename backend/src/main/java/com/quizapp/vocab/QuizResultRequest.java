package com.quizapp.vocab;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record QuizResultRequest(
        @Size(max = 50, message = "Quiz mode must be 50 characters or less.")
        String quizMode,

        @PositiveOrZero(message = "Challenge seconds cannot be negative.")
        Integer challengeSeconds,

        @PositiveOrZero(message = "Total questions cannot be negative.")
        int totalQuestions,

        @PositiveOrZero(message = "Correct answers cannot be negative.")
        int correctAnswers,

        @PositiveOrZero(message = "Wrong answers cannot be negative.")
        int wrongAnswers,

        @DecimalMin(value = "0.0", message = "Score must be at least 0.")
        @DecimalMax(value = "10.0", message = "Score must be at most 10.")
        double score,

        @PositiveOrZero(message = "Max combo cannot be negative.")
        int maxCombo,

        @NotNull(message = "Quiz answers are required.")
        @Size(max = 500, message = "Quiz result cannot include more than 500 answers.")
        List<@Valid QuizAnswerRequest> answers
) {
    private static final int MAX_QUIZ_COUNT = 500;
    private static final int MAX_CHALLENGE_SECONDS = 24 * 60 * 60;

    public QuizResultRequest {
        challengeSeconds = challengeSeconds == null ? null : clamp(challengeSeconds, 0, MAX_CHALLENGE_SECONDS);
        totalQuestions = clamp(totalQuestions, 0, MAX_QUIZ_COUNT);
        correctAnswers = clamp(correctAnswers, 0, totalQuestions);
        wrongAnswers = clamp(wrongAnswers, 0, totalQuestions);
        score = Double.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0;
        maxCombo = clamp(maxCombo, 0, totalQuestions);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
