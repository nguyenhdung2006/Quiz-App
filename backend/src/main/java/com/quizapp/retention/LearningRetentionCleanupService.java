package com.quizapp.retention;

import com.quizapp.quiz.LearningAttemptRepository;
import com.quizapp.quiz.LearningAttemptStatus;
import com.quizapp.review.ReviewOperationRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LearningRetentionCleanupService {
    public static final Duration RETENTION = Duration.ofDays(7);
    public static final int DEFAULT_BATCH_SIZE = 500;
    private static final Logger log = LoggerFactory.getLogger(LearningRetentionCleanupService.class);

    private final LearningAttemptRepository attempts;
    private final ReviewOperationRepository reviewOperations;
    private final LearningRetentionClock clock;
    private final int batchSize;

    public LearningRetentionCleanupService(
            LearningAttemptRepository attempts,
            ReviewOperationRepository reviewOperations,
            LearningRetentionClock clock,
            @Value("${app.retention.cleanup-batch-size:500}") int batchSize
    ) {
        if (batchSize < 1 || batchSize > DEFAULT_BATCH_SIZE) {
            throw new IllegalArgumentException("Retention cleanup batch size must be between 1 and 500.");
        }
        this.attempts = attempts;
        this.reviewOperations = reviewOperations;
        this.clock = clock;
        this.batchSize = batchSize;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public LearningRetentionCleanupResult cleanupOnce() {
        long started = System.nanoTime();
        Instant cutoff = clock.now().minus(RETENTION);
        PageRequest limit = PageRequest.of(0, batchSize);

        List<UUID> consumed = attempts.findRetentionEligibleIds(
                LearningAttemptStatus.CONSUMED, cutoff, limit);
        int deletedConsumed = consumed.isEmpty() ? 0
                : attempts.deleteConsumedRetentionEligible(consumed, cutoff);

        List<UUID> expiredIssued = attempts.findExpiredIssuedRetentionEligibleIds(
                LearningAttemptStatus.ISSUED, cutoff, limit);
        int deletedIssued = expiredIssued.isEmpty() ? 0
                : attempts.deleteExpiredIssuedRetentionEligible(expiredIssued, cutoff);

        List<UUID> review = reviewOperations.findRetentionEligibleIds(cutoff, limit);
        int deletedReview = review.isEmpty() ? 0
                : reviewOperations.deleteRetentionEligible(review, cutoff);

        long durationMillis = Duration.ofNanos(System.nanoTime() - started).toMillis();
        LearningRetentionCleanupResult result = new LearningRetentionCleanupResult(
                consumed.size(), deletedConsumed,
                expiredIssued.size(), deletedIssued,
                review.size(), deletedReview,
                durationMillis);
        log.info("[RETENTION] Cleanup pass completed consumedAttempts={} expiredIssuedAttempts={} "
                        + "reviewOperations={} durationMs={}",
                deletedConsumed, deletedIssued, deletedReview, durationMillis);
        return result;
    }
}
