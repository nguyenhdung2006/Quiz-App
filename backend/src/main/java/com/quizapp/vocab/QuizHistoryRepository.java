package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuizHistoryRepository extends JpaRepository<QuizHistory, Long> {
    long countByUser(AppUser user);
    List<QuizHistory> findByUserOrderByCreatedAtDesc(AppUser user);
    List<QuizHistory> findTop10ByUserOrderByCreatedAtDesc(AppUser user);
    List<QuizHistory> findByUserAndCreatedAtAfterOrderByCreatedAtDesc(AppUser user, Instant createdAt);

    @Query("""
            select count(q) as quizCount,
                   coalesce(sum(q.correctAnswers), 0) as correctAnswers,
                   coalesce(avg(q.score), 0) as averageScore
            from QuizHistory q
            where q.user = :user and q.createdAt > :createdAt
            """)
    QuizProgressProjection summarizeAfter(
            @Param("user") AppUser user,
            @Param("createdAt") Instant createdAt
    );

    interface QuizProgressProjection {
        long getQuizCount();
        long getCorrectAnswers();
        double getAverageScore();
    }
}
