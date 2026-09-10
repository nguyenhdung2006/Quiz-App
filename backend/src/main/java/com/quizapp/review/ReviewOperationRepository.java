package com.quizapp.review;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import java.util.List;

public interface ReviewOperationRepository extends Repository<ReviewOperation, UUID> {
    Optional<ReviewOperation> findById(UUID id);

    @Query("""
            select operation.id from ReviewOperation operation
            where operation.consumedAt < :cutoff
            order by operation.consumedAt asc, operation.id asc
            """)
    List<UUID> findRetentionEligibleIds(@Param("cutoff") Instant cutoff, Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from ReviewOperation operation
            where operation.id in :ids and operation.consumedAt < :cutoff
            """)
    int deleteRetentionEligible(@Param("ids") List<UUID> ids, @Param("cutoff") Instant cutoff);

    // Native INSERT deliberately avoids merge/upsert: an ID can never replace an accepted result.
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO review_operation
            (id, user_id, word_id, target_word_id, target_user_id, action, fingerprint,
             created_at, consumed_at, mastery, streak, next_review, message, resulting_revision)
            VALUES (:id, :userId, :wordId, :wordId, :userId, :action, :fingerprint,
                    :now, :now, :mastery, :streak, :nextReview, :message, :revision)
            """, nativeQuery = true)
    void insert(@Param("id") UUID id, @Param("userId") Long userId, @Param("wordId") Long wordId,
            @Param("action") String action, @Param("fingerprint") String fingerprint,
            @Param("now") Instant now, @Param("mastery") int mastery, @Param("streak") int streak,
            @Param("nextReview") Instant nextReview, @Param("message") String message,
            @Param("revision") long revision);
}
