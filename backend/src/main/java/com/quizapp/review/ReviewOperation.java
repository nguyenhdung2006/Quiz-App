package com.quizapp.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/** Insert-only ledger: no issued/partial state and no update API. */
@Entity
@Immutable
@Table(name = "review_operation")
public class ReviewOperation {
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(name = "word_id", nullable = false) private Long wordId;
    @Column(name = "target_word_id") private Long targetWordId;
    @Column(name = "target_user_id") private Long targetUserId;
    @Column(nullable = false, length = 20) private String action;
    @Column(nullable = false, length = 64) private String fingerprint;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "consumed_at", nullable = false) private Instant consumedAt;
    @Column(nullable = false) private int mastery;
    @Column(nullable = false) private int streak;
    @Column(name = "next_review", nullable = false) private Instant nextReview;
    @Column(nullable = false, length = 100) private String message;
    @Column(name = "resulting_revision", nullable = false) private long resultingRevision;

    protected ReviewOperation() { }

    public Long getUserId() { return userId; }
    public String getFingerprint() { return fingerprint; }
    public Long getTargetWordId() { return targetWordId; }
    public ReviewOperationOutcome outcome() {
        return new ReviewOperationOutcome(id, wordId, action, mastery, streak, nextReview, message, resultingRevision);
    }
}
