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
}
