package com.quizapp.vocab;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record WordRequest(
        @Positive
        Long id,

        UUID wordUid,

        @NotBlank(message = "English word is required.")
        @Size(max = VocabularyConstraints.WORD_MAX, message = "English word must be 255 characters or less.")
        String eng,

        @NotBlank(message = "Vietnamese meaning is required.")
        @Size(max = VocabularyConstraints.MEANING_MAX, message = "Vietnamese meaning must be 255 characters or less.")
        String vie,

        @Size(max = VocabularyConstraints.POS_MAX, message = "Part of speech must be 50 characters or less.")
        String pos,

        @Size(max = VocabularyConstraints.TAG_MAX, message = "Tag must be 100 characters or less.")
        String tag,

        @Size(max = VocabularyConstraints.IPA_MAX, message = "IPA must be 120 characters or less.")
        String ipa,

        @Size(max = VocabularyConstraints.LEVEL_MAX, message = "Level must be 40 characters or less.")
        String level,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Context must be 2000 characters or less.")
        String context,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Example must be 2000 characters or less.")
        String example,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Example meaning must be 2000 characters or less.")
        String exampleMeaning,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Collocation must be 2000 characters or less.")
        String collocation,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Synonyms must be 2000 characters or less.")
        String synonyms,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Antonyms must be 2000 characters or less.")
        String antonyms,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Common mistake must be 2000 characters or less.")
        String commonMistake,

        @Size(max = VocabularyConstraints.DETAIL_MAX, message = "Note must be 2000 characters or less.")
        String note,

        boolean favorite,
        boolean mastered,

        @Valid
        WordStatsDto stats
) {
}
