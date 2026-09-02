package com.quizapp.review;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ReviewAnswerRequest(
        @NotNull UUID operationId,
        @NotNull(message = "Word id is required.")
        @Positive(message = "Word id must be positive.")
        Long wordId,

        @NotNull Boolean correct,

        @NotBlank
        @Size(max = 40, message = "Review mode must be 40 characters or less.")
        String mode
) {
}
