package com.quizapp.vocab;

public class SyncClientUpgradeRequiredException extends RuntimeException {
    public SyncClientUpgradeRequiredException() {
        super("Sync client upgrade required.");
    }
}
