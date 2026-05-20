package com.quiz.wrongword;

import jakarta.validation.constraints.NotBlank;

public record WrongWordRequest(
        @NotBlank String eng,
        @NotBlank String vie,
        String pos,
        String tag,
        String example,
        String note,
        Boolean mastered) {
}
