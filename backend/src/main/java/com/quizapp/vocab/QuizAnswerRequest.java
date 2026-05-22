package com.quizapp.vocab;

public record QuizAnswerRequest(
        String eng,
        String questionMode,
        String selectedAnswer,
        String correctAnswer,
        boolean correct
) {
}
