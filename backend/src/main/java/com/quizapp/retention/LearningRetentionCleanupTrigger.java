package com.quizapp.retention;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class LearningRetentionCleanupTrigger {
    private static final Logger log = LoggerFactory.getLogger(LearningRetentionCleanupTrigger.class);

    private final LearningRetentionCleanupService cleanup;
    private final LearningRetentionClock clock;
    private final Duration throttle;
    private final AtomicReference<Instant> lastStarted = new AtomicReference<>();

    public LearningRetentionCleanupTrigger(
            LearningRetentionCleanupService cleanup,
            LearningRetentionClock clock,
            @Value("${app.retention.cleanup-throttle:PT1H}") Duration throttle
    ) {
        if (throttle.isNegative()) {
            throw new IllegalArgumentException("Retention cleanup throttle cannot be negative.");
        }
        this.cleanup = cleanup;
        this.clock = clock;
        this.throttle = throttle;
    }

    public void afterLedgerWrite() {
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    runIfDue();
                }
            });
            return;
        }
        runIfDue();
    }

    private void runIfDue() {
        try {
            Instant now = clock.now();
            while (true) {
                Instant previous = lastStarted.get();
                if (previous != null && now.isBefore(previous.plus(throttle))) {
                    return;
                }
                if (lastStarted.compareAndSet(previous, now)) {
                    break;
                }
            }
            cleanup.cleanupOnce();
        } catch (RuntimeException exception) {
            log.warn("[RETENTION] Cleanup pass failed type={}", exception.getClass().getSimpleName());
        }
    }
}
