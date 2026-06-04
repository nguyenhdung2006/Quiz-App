package com.quizapp.vocab;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record QuizAnswerRequest(
        @NotBlank(message = "Answer English word is required.")
        @Size(max = 255, message = "Answer English word must be 255 characters or less.")
        String eng,

        @Size(max = 20, message = "Question mode must be 20 characters or less.")
        String questionMode,

        @Size(max = 2_000, message = "Selected answer must be 2000 characters or less.")
        String selectedAnswer,

        @NotBlank(message = "Correct answer is required.")
        @Size(max = 2_000, message = "Correct answer must be 2000 characters or less.")
        String correctAnswer,

        boolean correct
) {
}
