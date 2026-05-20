package com.quiz.word;

import jakarta.validation.constraints.NotBlank;

public record WordRequest(
        @NotBlank String eng,
        @NotBlank String vie,
        String pos,
        String tag,
        String example,
        String note,
        Boolean favorite,
        Boolean mastered,
        Integer seen,
        Integer correct,
        Integer wrong,
        Integer streak,
        Integer bestStreak) {
}
