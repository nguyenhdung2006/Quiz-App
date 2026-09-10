package com.quizapp.review;

public class ReviewOperationConflictException extends RuntimeException {
    private final String error;

    public ReviewOperationConflictException(String error, String message) {
        super(message);
        this.error = error;
    }

    public String getError() { return error; }
}
