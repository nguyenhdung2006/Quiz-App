package com.quizapp.vocab;

import com.quizapp.user.ProfileDto;
import java.util.List;

public record SyncResponse(
        long revision,
        ProfileDto profile,
        List<WordDto> vocab,
        List<WordDto> wrongWords,
        ProgressSummaryDto progress,
        List<AchievementDto> achievements,
        List<QuizHistoryDto> quizHistory
) {
}
