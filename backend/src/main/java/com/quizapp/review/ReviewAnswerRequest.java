package com.quizapp.review;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ReviewAnswerRequest(
        @NotNull(message = "Word id is required.")
        @Positive(message = "Word id must be positive.")
        Long wordId,

        boolean correct,

        @Size(max = 40, message = "Review mode must be 40 characters or less.")
        String mode
) {
}
