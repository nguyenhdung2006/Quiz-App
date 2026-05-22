package com.quizapp.vocab;

public record WordDto(
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
    public static WordDto from(VocabularyWord word) {
        return new WordDto(
                word.getId(),
                word.getEng(),
                word.getVie(),
                word.getPos(),
                word.getTag(),
                word.getExample(),
                word.getNote(),
                word.isFavorite(),
                word.isMastered(),
                WordStatsDto.from(word.getStats())
        );
    }
}
