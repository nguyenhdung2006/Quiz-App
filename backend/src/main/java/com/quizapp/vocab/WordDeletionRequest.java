package com.quizapp.vocab;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record WordDeletionRequest(
        @NotNull(message = "wordUid is required.")
        UUID wordUid
) {
}
