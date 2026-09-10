package com.quizapp.retention;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class LearningRetentionCleanupTriggerTests {
    @Test
    void runsAtMostOncePerHourPerProcess() {
        LearningRetentionCleanupService cleanup = mock(LearningRetentionCleanupService.class);
        LearningRetentionClock clock = mock(LearningRetentionClock.class);
        Instant start = Instant.parse("2026-09-02T12:00:00Z");
        when(clock.now()).thenReturn(start, start.plus(Duration.ofMinutes(59)), start.plus(Duration.ofHours(1)));
        LearningRetentionCleanupTrigger trigger = new LearningRetentionCleanupTrigger(
                cleanup, clock, Duration.ofHours(1));

        trigger.afterLedgerWrite();
        trigger.afterLedgerWrite();
        trigger.afterLedgerWrite();

        verify(cleanup, times(2)).cleanupOnce();
    }

    @Test
    void maintenanceFailureNeverEscapesTrigger() {
        LearningRetentionCleanupService cleanup = mock(LearningRetentionCleanupService.class);
        LearningRetentionClock clock = mock(LearningRetentionClock.class);
        when(clock.now()).thenReturn(Instant.parse("2026-09-02T12:00:00Z"));
        when(cleanup.cleanupOnce()).thenThrow(new IllegalStateException("maintenance failed"));
        LearningRetentionCleanupTrigger trigger = new LearningRetentionCleanupTrigger(
                cleanup, clock, Duration.ofHours(1));

        assertThatNoException().isThrownBy(trigger::afterLedgerWrite);
    }
}
