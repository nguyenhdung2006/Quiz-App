package com.quizapp.analytics;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class AnalyticsTimeProvider {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsTimeProvider.class);
    private final Clock clock;
    private final ZoneId zone;

    AnalyticsTimeProvider(
            Clock analyticsClock,
            @Value("${app.analytics.default-zone:UTC}") String configuredZone
    ) {
        this.clock = analyticsClock;
        this.zone = resolveZone(configuredZone);
    }

    Instant now() {
        return clock.instant();
    }

    LocalDate today() {
        return LocalDate.ofInstant(now(), zone);
    }

    LocalDate toDate(Instant instant) {
        return LocalDate.ofInstant(instant, zone);
    }

    ZoneId zone() {
        return zone;
    }

    private ZoneId resolveZone(String configuredZone) {
        String candidate = configuredZone == null ? "" : configuredZone.trim();
        if (candidate.isEmpty()) return ZoneOffset.UTC;
        if ("UTC".equalsIgnoreCase(candidate) || "Z".equalsIgnoreCase(candidate)) return ZoneOffset.UTC;
        try {
            return ZoneId.of(candidate);
        } catch (DateTimeException error) {
            log.warn("[ANALYTICS] Invalid default timezone '{}'; falling back to UTC", candidate);
            return ZoneOffset.UTC;
        }
    }
}
