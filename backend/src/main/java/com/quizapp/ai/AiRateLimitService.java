package com.quizapp.ai;

import com.quizapp.user.AppUser;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Service;

@Service
public class AiRateLimitService {
    private static final Duration STALE_ENTRY_AGE = Duration.ofDays(2);

    private final AiRateLimitProperties properties;
    private final ConcurrentMap<String, UsageWindow> usageByKey = new ConcurrentHashMap<>();
    private final AtomicInteger checksSinceCleanup = new AtomicInteger();

    public AiRateLimitService(AiRateLimitProperties properties) {
        this.properties = properties;
    }

    public void checkAllowed(AppUser user, AiRateLimitAction action) {
        requireSupportedMode();
        AiRateLimitProperties.Limit limit = properties.limitFor(action);
        Instant now = Instant.now();
        String key = action.name() + ":" + userKey(user);
        UsageWindow usage = usageByKey.computeIfAbsent(
                key,
                ignored -> new UsageWindow(LocalDate.now(ZoneOffset.UTC), now)
        );

        synchronized (usage) {
            usage.resetDayIfNeeded(LocalDate.now(ZoneOffset.UTC));
            Duration minuteWindow = properties.getMinuteWindow();
            usage.removeOldMinuteAttempts(now, minuteWindow);

            long retryAfterSeconds = retryAfterSeconds(usage, limit, now, minuteWindow);
            if (retryAfterSeconds > 0) {
                throw new AiRateLimitExceededException(retryAfterSeconds);
            }

            usage.minuteAttempts.addLast(now);
            usage.dayCount++;
            usage.lastSeen = now;
        }

        cleanupOccasionally(now);
    }

    private long retryAfterSeconds(
            UsageWindow usage,
            AiRateLimitProperties.Limit limit,
            Instant now,
            Duration minuteWindow
    ) {
        if (usage.minuteAttempts.size() >= limit.getPerMinute()) {
            Instant oldestAttempt = usage.minuteAttempts.peekFirst();
            if (oldestAttempt == null) {
                return minuteWindow.toSeconds();
            }
            long elapsedSeconds = Duration.between(oldestAttempt, now).toSeconds();
            return Math.max(1, minuteWindow.toSeconds() - elapsedSeconds);
        }

        if (usage.dayCount >= limit.getPerDay()) {
            Instant nextUtcDay = usage.day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            return Math.max(1, Duration.between(now, nextUtcDay).toSeconds());
        }

        return 0;
    }

    private void requireSupportedMode() {
        if (!"in-memory".equals(properties.normalizedMode())) {
            throw new IllegalStateException("Only in-memory AI rate limiting is implemented.");
        }
    }

    private String userKey(AppUser user) {
        if (user.getId() != null) {
            return "user:" + user.getId();
        }

        String email = user.getEmail() == null ? "" : user.getEmail().trim().toLowerCase(Locale.ROOT);
        if (!email.isBlank()) {
            return "email:" + email;
        }

        throw new IllegalStateException("Authenticated user identity is required for AI rate limiting.");
    }

    private void cleanupOccasionally(Instant now) {
        if (checksSinceCleanup.incrementAndGet() % 100 != 0) {
            return;
        }

        Instant staleBefore = now.minus(STALE_ENTRY_AGE);
        usageByKey.entrySet().removeIf(entry -> entry.getValue().lastSeen.isBefore(staleBefore));
    }

    private static class UsageWindow {
        private final Deque<Instant> minuteAttempts = new ArrayDeque<>();
        private LocalDate day;
        private int dayCount;
        private Instant lastSeen;

        private UsageWindow(LocalDate day, Instant lastSeen) {
            this.day = day;
            this.lastSeen = lastSeen;
        }

        private void resetDayIfNeeded(LocalDate currentDay) {
            if (day.equals(currentDay)) {
                return;
            }

            day = currentDay;
            dayCount = 0;
        }

        private void removeOldMinuteAttempts(Instant now, Duration minuteWindow) {
            Instant oldestAllowed = now.minus(minuteWindow);
            while (!minuteAttempts.isEmpty() && !minuteAttempts.peekFirst().isAfter(oldestAllowed)) {
                minuteAttempts.removeFirst();
            }
        }
    }
}
