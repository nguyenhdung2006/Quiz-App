package com.quizapp.quiz;

public class QuizAttemptConflictException extends RuntimeException {
    private final String error;

    public QuizAttemptConflictException(String error, String message) {
        super(message);
        this.error = error;
    }

    public String getError() {
        return error;
    }
}
