package com.quizapp.vocab;

import com.quizapp.user.ProfileRequest;
import java.util.List;

public record SyncRequest(
        ProfileRequest profile,
        List<WordRequest> vocab,
        List<WordRequest> wrongWords
) {
}
