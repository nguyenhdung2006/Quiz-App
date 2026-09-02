package com.quizapp.quiz;

import com.quizapp.user.AppUser;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
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

    @Query("""
            select attempt.id from LearningAttempt attempt
            where attempt.status = :status and attempt.consumedAt < :cutoff
            order by attempt.consumedAt asc, attempt.id asc
            """)
    List<UUID> findRetentionEligibleIds(
            @Param("status") LearningAttemptStatus status,
            @Param("cutoff") Instant cutoff,
            Pageable pageable
    );

    @Query("""
            select attempt.id from LearningAttempt attempt
            where attempt.status = :status and attempt.expiresAt < :cutoff
            order by attempt.expiresAt asc, attempt.id asc
            """)
    List<UUID> findExpiredIssuedRetentionEligibleIds(
            @Param("status") LearningAttemptStatus status,
            @Param("cutoff") Instant cutoff,
            Pageable pageable
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from LearningAttempt attempt
            where attempt.id in :ids and attempt.status = 'CONSUMED'
                and attempt.consumedAt < :cutoff
            """)
    int deleteConsumedRetentionEligible(@Param("ids") List<UUID> ids, @Param("cutoff") Instant cutoff);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from LearningAttempt attempt
            where attempt.id in :ids and attempt.status = 'ISSUED'
                and attempt.expiresAt < :cutoff
            """)
    int deleteExpiredIssuedRetentionEligible(@Param("ids") List<UUID> ids, @Param("cutoff") Instant cutoff);
}
