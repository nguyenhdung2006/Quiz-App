package com.quizapp.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GenerateDeckRequest(
        @NotBlank(message = "Text is required.")
        @Size(max = 8_000, message = "Text must be 8000 characters or less.")
        String text
) {
}
