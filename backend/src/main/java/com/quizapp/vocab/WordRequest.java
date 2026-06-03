package com.quizapp.vocab;

public record WordRequest(
        Long id,
        String eng,
        String vie,
        String pos,
        String tag,
        String ipa,
        String level,
        String context,
        String example,
        String exampleMeaning,
        String collocation,
        String synonyms,
        String antonyms,
        String commonMistake,
        String note,
        boolean favorite,
        boolean mastered,
        WordStatsDto stats
) {
}
