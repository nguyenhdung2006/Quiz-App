package com.quizapp.vocab;

public class SyncItemValidationException extends IllegalArgumentException {
    private final String fieldPath;

    public SyncItemValidationException(String fieldPath, String message) {
        super(message);
        this.fieldPath = fieldPath;
    }

    public String getFieldPath() {
        return fieldPath;
    }
}
