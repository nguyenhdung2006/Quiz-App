package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class LearningProgressService {
    private final VocabularyRepository words;
    private final QuizHistoryRepository quizHistory;

    public LearningProgressService(
            VocabularyRepository words,
            QuizHistoryRepository quizHistory
    ) {
        this.words = words;
        this.quizHistory = quizHistory;
    }

    public ProgressSummaryDto progress(AppUser user, int unlockedAchievementCount) {
        Instant now = Instant.now();
        return progress(user, unlockedAchievementCount, words.countDueForReview(user, now), now);
    }

    public ProgressSummaryDto progress(AppUser user, int unlockedAchievementCount, long dueToday) {
        return progress(user, unlockedAchievementCount, dueToday, Instant.now());
    }

    private ProgressSummaryDto progress(
            AppUser user,
            int unlockedAchievementCount,
            long dueToday,
            Instant now
    ) {
        QuizHistoryRepository.QuizProgressProjection weekly = quizHistory.summarizeAfter(
                user,
                now.minus(Duration.ofDays(7))
        );

        return new ProgressSummaryDto(
                quizHistory.countByUser(user),
                Math.toIntExact(weekly.getQuizCount()),
                Math.toIntExact(weekly.getCorrectAnswers()),
                Math.round(weekly.getAverageScore() * 100.0) / 100.0,
                dueToday,
                unlockedAchievementCount
        );
    }

    public Instant nextReview(WordStats stats, boolean correct) {
        int days;
        if (!correct) {
            days = 1;
        } else {
            days = switch (Math.min(stats.getCurrentStreak(), 5)) {
                case 0, 1 -> 1;
                case 2 -> 3;
                case 3 -> 7;
                case 4 -> 14;
                default -> 30;
            };
        }
        return Instant.now().plus(Duration.ofDays(days));
    }
}
