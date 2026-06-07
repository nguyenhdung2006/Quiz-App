package com.quizapp.ai;

public record AiRateLimitError(
        String error,
        String message,
        long retryAfterSeconds
) {
    public static AiRateLimitError standard(long retryAfterSeconds) {
        return new AiRateLimitError(
                "Rate limit exceeded",
                "Too many AI requests. Please try again later.",
                retryAfterSeconds
        );
    }
}
