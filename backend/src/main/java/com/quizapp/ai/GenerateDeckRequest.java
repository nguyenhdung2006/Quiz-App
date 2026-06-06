package com.quizapp.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record GenerateDeckRequest(
        @NotBlank(message = "Text is required.")
        @Size(max = 8_000, message = "Text must be 8000 characters or less.")
        String text,

        @Size(max = 8, message = "Target level is too long.")
        @Pattern(regexp = "(?i)^(|any|a1|a2|b1|b2|c1|c2)$", message = "Target level must be Any, A1, A2, B1, B2, C1, or C2.")
        String targetLevel,

        @Min(value = 1, message = "Max words must be at least 1.")
        @Max(value = 30, message = "Max words must be 30 or less.")
        Integer maxWords
) {
    public String normalizedTargetLevel() {
        String value = targetLevel == null ? "" : targetLevel.trim();
        if (value.isBlank() || value.equalsIgnoreCase("any")) {
            return "Any";
        }
        return value.toUpperCase(Locale.ROOT);
    }

    public boolean hasSpecificTargetLevel() {
        return !"Any".equals(normalizedTargetLevel());
    }

    public int normalizedMaxWords() {
        if (maxWords == null) {
            return 20;
        }
        return Math.max(1, Math.min(30, maxWords));
    }
}
