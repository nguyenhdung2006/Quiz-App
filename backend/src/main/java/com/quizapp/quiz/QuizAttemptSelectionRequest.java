package com.quizapp.quiz;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record QuizAttemptSelectionRequest(
        @NotNull(message = "Item ordinal is required.")
        @Min(value = 0, message = "Item ordinal cannot be negative.")
        @Max(value = 499, message = "Item ordinal must be less than 500.")
        Integer ordinal,

        @Size(max = 2000, message = "Selected answer must be 2000 characters or less.")
        String selectedAnswer
) {
}
