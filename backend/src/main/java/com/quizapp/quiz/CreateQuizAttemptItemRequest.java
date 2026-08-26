package com.quizapp.quiz;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record CreateQuizAttemptItemRequest(
        @NotNull(message = "Word id is required.")
        @Positive(message = "Word id must be positive.")
        Long wordId,

        @NotNull(message = "Question mode is required.")
        @Pattern(regexp = "eng|vie", message = "Question mode must be eng or vie.")
        String questionMode
) {
}
