package com.quizapp.shared;

import java.util.List;

public record ApiError(
        String message,
        List<String> errors
) {
    public static ApiError of(String message, List<String> errors) {
        return new ApiError(message, errors == null ? List.of() : errors);
    }
}
