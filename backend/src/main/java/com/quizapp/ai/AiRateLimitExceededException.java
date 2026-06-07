package com.quizapp.ai;

public class AiRateLimitExceededException extends RuntimeException {
    private final long retryAfterSeconds;

    public AiRateLimitExceededException(long retryAfterSeconds) {
        super("Too many AI requests. Please try again later.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
