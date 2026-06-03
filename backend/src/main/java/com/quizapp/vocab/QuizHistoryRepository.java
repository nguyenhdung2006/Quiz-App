package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuizHistoryRepository extends JpaRepository<QuizHistory, Long> {
    long countByUser(AppUser user);
    List<QuizHistory> findTop10ByUserOrderByCreatedAtDesc(AppUser user);
    List<QuizHistory> findByUserAndCreatedAtAfterOrderByCreatedAtDesc(AppUser user, Instant createdAt);
}
