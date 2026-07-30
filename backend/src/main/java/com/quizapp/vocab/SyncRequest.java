package com.quizapp.vocab;

import com.quizapp.user.ProfileRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SyncRequest(
        Integer syncContractVersion,

        Long expectedRevision,

        @Valid
        ProfileRequest profile,

        @Size(max = 5_000, message = "Sync payload cannot include more than 5000 vocabulary words.")
        List<WordRequest> vocab,

        @Valid
        @Size(max = 5_000, message = "Sync payload cannot include more than 5000 deletions.")
        List<WordDeletionRequest> deletions,

        @Size(max = 5_000, message = "Sync payload cannot include more than 5000 wrong words.")
        List<WordRequest> wrongWords
) {
}
