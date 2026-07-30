package com.quizapp.vocab;

import java.time.Instant;
import java.util.UUID;

public record WordTombstoneDto(
        UUID wordUid,
        Instant deletedAt,
        long deletedRevision
) {
    public static WordTombstoneDto from(WordTombstone tombstone) {
        return new WordTombstoneDto(
                tombstone.getWordUid(),
                tombstone.getDeletedAt(),
                tombstone.getDeletedRevision()
        );
    }
}
