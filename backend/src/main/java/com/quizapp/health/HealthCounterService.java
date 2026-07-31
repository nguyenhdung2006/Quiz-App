package com.quizapp.health;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

@Service
public class HealthCounterService {
    private final Instant startedAt = Instant.now();
    private final MeterRegistry meterRegistry;
    private final ConcurrentMap<String, Counter> requestCounters = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Counter> requestErrorCounters = new ConcurrentHashMap<>();
    private final Counter syncConflictMetric;
    private final Counter aiFailureMetric;
    private final Counter reviewFailureMetric;
    private final Counter validationErrorMetric;
    private final Counter serverErrorMetric;
    private final Counter snapshotFailureMetric;
    private final Counter quizFailureMetric;
    private final Counter analyticsFailureMetric;
    private final Counter rateLimitHitMetric;
    private final AtomicLong syncConflicts = new AtomicLong();
    private final AtomicLong aiFailures = new AtomicLong();
    private final AtomicLong reviewFailures = new AtomicLong();
    private final AtomicLong validationErrors = new AtomicLong();
    private final AtomicLong serverErrors = new AtomicLong();
    private final AtomicLong snapshotFailures = new AtomicLong();
    private final AtomicLong quizFailures = new AtomicLong();
    private final AtomicLong analyticsFailures = new AtomicLong();
    private final AtomicLong rateLimitHits = new AtomicLong();

    public HealthCounterService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.syncConflictMetric = counter("wordarena.sync.conflicts", "Sync revision conflicts.");
        this.aiFailureMetric = counter("wordarena.ai.failures", "AI provider or response failures.");
        this.reviewFailureMetric = counter("wordarena.review.failures", "Spaced repetition processing failures.");
        this.validationErrorMetric = counter("wordarena.validation.errors", "Request validation or parsing errors.");
        this.serverErrorMetric = counter("wordarena.server.errors", "Unhandled server errors.");
        this.snapshotFailureMetric = counter("wordarena.snapshot.failures", "Cloud snapshot failures.");
        this.quizFailureMetric = counter("wordarena.quiz.failures", "Quiz result processing failures.");
        this.analyticsFailureMetric = counter("wordarena.analytics.failures", "Analytics processing failures.");
        this.rateLimitHitMetric = counter("wordarena.rate_limit.hits", "Rate limit blocks.");
    }

    public void incrementSyncConflicts() {
        syncConflicts.incrementAndGet();
        syncConflictMetric.increment();
    }

    public void incrementAiFailures() {
        aiFailures.incrementAndGet();
        aiFailureMetric.increment();
    }

    public void incrementReviewFailures() {
        reviewFailures.incrementAndGet();
        reviewFailureMetric.increment();
    }

    public void incrementValidationErrors() {
        validationErrors.incrementAndGet();
        validationErrorMetric.increment();
    }

    public void incrementServerErrors() {
        serverErrors.incrementAndGet();
        serverErrorMetric.increment();
    }

    public void incrementSnapshotFailures() {
        snapshotFailures.incrementAndGet();
        snapshotFailureMetric.increment();
    }

    public void incrementQuizFailures() {
        quizFailures.incrementAndGet();
        quizFailureMetric.increment();
    }

    public void incrementAnalyticsFailures() {
        analyticsFailures.incrementAndGet();
        analyticsFailureMetric.increment();
    }

    public void incrementRateLimitHits() {
        rateLimitHits.incrementAndGet();
        rateLimitHitMetric.increment();
    }

    public void recordHttpRequest(int status) {
        int normalizedStatus = status <= 0 ? 500 : status;
        String statusCode = String.valueOf(normalizedStatus);
        String statusGroup = statusGroup(normalizedStatus);
        requestCounters.computeIfAbsent(
                statusCode,
                ignored -> Counter.builder("wordarena.http.requests")
                        .description("HTTP request count by bounded status labels.")
                        .tag("status", statusCode)
                        .tag("statusGroup", statusGroup)
                        .register(meterRegistry)
        ).increment();

        if ("4xx".equals(statusGroup) || "5xx".equals(statusGroup)) {
            requestErrorCounters.computeIfAbsent(
                    statusGroup,
                    ignored -> Counter.builder("wordarena.http.errors")
                            .description("HTTP error count by status group.")
                            .tag("statusGroup", statusGroup)
                            .register(meterRegistry)
            ).increment();
        }
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
        counters.put("rateLimitHits", rateLimitHits.get());
        result.put("counters", counters);
        return result;
    }

    private Counter counter(String name, String description) {
        return Counter.builder(name)
                .description(description)
                .register(meterRegistry);
    }

    private String statusGroup(int status) {
        if (status >= 100 && status < 600) {
            return (status / 100) + "xx";
        }
        return "unknown";
    }
}
