package com.quizapp.vocab;

public record SyncConflictResponse(
        String error,
        String message,
        Long expectedRevision,
        long currentRevision
) {
    public static SyncConflictResponse revisionConflict(Long expectedRevision, long currentRevision) {
        return new SyncConflictResponse(
                "SYNC_REVISION_CONFLICT",
                "Cloud data changed. Please refresh sync state.",
                expectedRevision,
                currentRevision
        );
    }
}
