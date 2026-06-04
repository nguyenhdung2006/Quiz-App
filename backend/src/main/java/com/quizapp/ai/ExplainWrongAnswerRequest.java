package com.quizapp.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExplainWrongAnswerRequest(
        @NotBlank(message = "Word is required.")
        @Size(max = 255, message = "Word must be 255 characters or less.")
        String word,

        @Size(max = 2_000, message = "User answer must be 2000 characters or less.")
        String userAnswer,

        @NotBlank(message = "Correct answer is required.")
        @Size(max = 2_000, message = "Correct answer must be 2000 characters or less.")
        String correctAnswer,

        @Size(max = 40, message = "Question mode must be 40 characters or less.")
        String questionMode,

        @Size(max = 100, message = "Tag must be 100 characters or less.")
        String tag,

        @Size(max = 40, message = "Level must be 40 characters or less.")
        String level,

        @Size(max = 2_000, message = "Example must be 2000 characters or less.")
        String example,

        @Size(max = 2_000, message = "Note must be 2000 characters or less.")
        String note
) {
}
