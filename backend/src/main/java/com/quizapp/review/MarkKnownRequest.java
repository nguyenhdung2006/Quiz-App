package com.quizapp.review;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

public record MarkKnownRequest(
        @NotNull UUID operationId,
        @NotNull(message = "Word id is required.")
        @Positive(message = "Word id must be positive.")
        Long wordId
) {
}
