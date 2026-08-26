package com.quizapp.quiz;

import com.quizapp.user.AppUser;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LearningAttemptRepository extends JpaRepository<LearningAttempt, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select attempt from LearningAttempt attempt where attempt.id = :id and attempt.user = :user")
    Optional<LearningAttempt> findOwnedByIdForUpdate(
            @Param("id") UUID id,
            @Param("user") AppUser user
    );
}
