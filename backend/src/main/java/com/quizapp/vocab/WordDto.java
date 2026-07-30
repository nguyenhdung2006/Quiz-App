package com.quizapp.vocab;

import java.time.Instant;
import java.util.UUID;

public record WordDto(
        Long id,
        UUID wordUid,
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
        WordStatsDto stats,
        Instant updatedAt
) {
    public static WordDto from(VocabularyWord word) {
        return new WordDto(
                word.getId(),
                word.getWordUid(),
                word.getEng(),
                word.getVie(),
                word.getPos(),
                word.getTag(),
                word.getIpa(),
                word.getLevel(),
                word.getContext(),
                word.getExample(),
                word.getExampleMeaning(),
                word.getCollocation(),
                word.getSynonyms(),
                word.getAntonyms(),
                word.getCommonMistake(),
                word.getNote(),
                word.isFavorite(),
                word.isMastered(),
                WordStatsDto.from(word.getStats()),
                word.getUpdatedAt()
        );
    }
}
