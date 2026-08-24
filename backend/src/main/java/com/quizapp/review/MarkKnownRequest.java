package com.quizapp.review;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record MarkKnownRequest(
        @NotNull(message = "Word id is required.")
        @Positive(message = "Word id must be positive.")
        Long wordId
) {
}
