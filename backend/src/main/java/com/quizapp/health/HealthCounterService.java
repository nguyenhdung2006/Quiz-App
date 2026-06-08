package com.quizapp.health;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

@Service
public class HealthCounterService {
    private final Instant startedAt = Instant.now();
    private final AtomicLong syncConflicts = new AtomicLong();
    private final AtomicLong aiFailures = new AtomicLong();
    private final AtomicLong reviewFailures = new AtomicLong();
    private final AtomicLong validationErrors = new AtomicLong();
    private final AtomicLong serverErrors = new AtomicLong();
    private final AtomicLong snapshotFailures = new AtomicLong();
    private final AtomicLong quizFailures = new AtomicLong();
    private final AtomicLong analyticsFailures = new AtomicLong();

    public void incrementSyncConflicts() {
        syncConflicts.incrementAndGet();
    }

    public void incrementAiFailures() {
        aiFailures.incrementAndGet();
    }

    public void incrementReviewFailures() {
        reviewFailures.incrementAndGet();
    }

    public void incrementValidationErrors() {
        validationErrors.incrementAndGet();
    }

    public void incrementServerErrors() {
        serverErrors.incrementAndGet();
    }

    public void incrementSnapshotFailures() {
        snapshotFailures.incrementAndGet();
    }

    public void incrementQuizFailures() {
        quizFailures.incrementAndGet();
    }

    public void incrementAnalyticsFailures() {
        analyticsFailures.incrementAndGet();
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("since", startedAt.toString());
        result.put("uptimeSeconds", Duration.between(startedAt, Instant.now()).getSeconds());
        Map<String, Long> counters = new LinkedHashMap<>();
        counters.put("syncConflicts", syncConflicts.get());
        counters.put("aiFailures", aiFailures.get());
        counters.put("reviewFailures", reviewFailures.get());
        counters.put("validationErrors", validationErrors.get());
        counters.put("serverErrors", serverErrors.get());
        counters.put("snapshotFailures", snapshotFailures.get());
        counters.put("quizFailures", quizFailures.get());
        counters.put("analyticsFailures", analyticsFailures.get());
        result.put("counters", counters);
        return result;
    }
}
