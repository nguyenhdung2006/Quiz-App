package com.quizapp.vocab;

public record WordRequest(
        Long id,
        String eng,
        String vie,
        String pos,
        String tag,
        String example,
        String note,
        boolean favorite,
        boolean mastered,
        WordStatsDto stats
) {
}
