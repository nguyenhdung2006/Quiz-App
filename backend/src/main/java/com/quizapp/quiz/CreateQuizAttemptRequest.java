package com.quizapp.quiz;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateQuizAttemptRequest(
        @NotBlank(message = "Quiz mode is required.")
        @Size(max = 50, message = "Quiz mode must be 50 characters or less.")
        String quizMode,

        @Min(value = 0, message = "Challenge seconds cannot be negative.")
        @Max(value = 86400, message = "Challenge seconds must be 86400 or less.")
        Integer challengeSeconds,

        @NotEmpty(message = "At least one quiz item is required.")
        @Size(max = 500, message = "Quiz attempt cannot include more than 500 items.")
        List<@Valid CreateQuizAttemptItemRequest> items
) {
}
