package com.quizapp.vocab;

public class SyncRevisionConflictException extends RuntimeException {
    private final Long expectedRevision;
    private final long currentRevision;

    public SyncRevisionConflictException(Long expectedRevision, long currentRevision) {
        super("Cloud data changed. Please refresh sync state.");
        this.expectedRevision = expectedRevision;
        this.currentRevision = currentRevision;
    }

    public Long getExpectedRevision() {
        return expectedRevision;
    }

    public long getCurrentRevision() {
        return currentRevision;
    }
}
