package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
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
        Instant weekStart = Instant.now().minus(Duration.ofDays(7));
        List<QuizHistory> weekly = quizHistory.findByUserAndCreatedAtAfterOrderByCreatedAtDesc(user, weekStart);
        int weeklyCorrect = weekly.stream().mapToInt(QuizHistory::getCorrectAnswers).sum();
        double weeklyAverage = weekly.isEmpty()
                ? 0
                : weekly.stream().mapToDouble(QuizHistory::getScore).average().orElse(0);
        long dueToday = words.findByUserOrderByCreatedAtDesc(user).stream()
                .map(VocabularyWord::getStats)
                .filter(stats -> stats != null && stats.getNextReview() != null)
                .filter(stats -> !stats.getNextReview().isAfter(Instant.now()))
                .count();

        return new ProgressSummaryDto(
                quizHistory.countByUser(user),
                weekly.size(),
                weeklyCorrect,
                Math.round(weeklyAverage * 100.0) / 100.0,
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
