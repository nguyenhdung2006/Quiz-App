package com.quizapp.quiz;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SubmitQuizAttemptRequest(
        @NotEmpty(message = "Quiz answers are required.")
        @Size(max = 500, message = "Quiz submission cannot include more than 500 answers.")
        List<@Valid QuizAttemptSelectionRequest> answers
) {
}
