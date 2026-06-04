package com.quizapp.vocab;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record WordRequest(
        @Positive
        Long id,

        @NotBlank(message = "English word is required.")
        @Size(max = 255, message = "English word must be 255 characters or less.")
        String eng,

        @NotBlank(message = "Vietnamese meaning is required.")
        @Size(max = 255, message = "Vietnamese meaning must be 255 characters or less.")
        String vie,

        @Size(max = 50, message = "Part of speech must be 50 characters or less.")
        String pos,

        @Size(max = 100, message = "Tag must be 100 characters or less.")
        String tag,

        @Size(max = 120, message = "IPA must be 120 characters or less.")
        String ipa,

        @Size(max = 40, message = "Level must be 40 characters or less.")
        String level,

        @Size(max = 2_000, message = "Context must be 2000 characters or less.")
        String context,

        @Size(max = 2_000, message = "Example must be 2000 characters or less.")
        String example,

        @Size(max = 2_000, message = "Example meaning must be 2000 characters or less.")
        String exampleMeaning,

        @Size(max = 2_000, message = "Collocation must be 2000 characters or less.")
        String collocation,

        @Size(max = 2_000, message = "Synonyms must be 2000 characters or less.")
        String synonyms,

        @Size(max = 2_000, message = "Antonyms must be 2000 characters or less.")
        String antonyms,

        @Size(max = 2_000, message = "Common mistake must be 2000 characters or less.")
        String commonMistake,

        @Size(max = 2_000, message = "Note must be 2000 characters or less.")
        String note,

        boolean favorite,
        boolean mastered,

        @Valid
        WordStatsDto stats
) {
}
