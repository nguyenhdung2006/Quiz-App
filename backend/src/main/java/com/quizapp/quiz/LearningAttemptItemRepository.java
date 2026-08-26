package com.quizapp.quiz;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningAttemptItemRepository extends JpaRepository<LearningAttemptItem, Long> {
    @EntityGraph(attributePaths = {"word", "word.stats"})
    List<LearningAttemptItem> findByAttemptOrderByOrdinalAsc(LearningAttempt attempt);
}
