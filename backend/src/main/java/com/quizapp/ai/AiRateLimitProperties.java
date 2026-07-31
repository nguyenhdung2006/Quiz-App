package com.quizapp.ai;

import java.time.Duration;
import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "ai.rate-limit")
public class AiRateLimitProperties {
    private String mode = "in-memory";
    private Duration minuteWindow = Duration.ofMinutes(1);
    private Limit explain = new Limit(10, 100);
    private Limit deck = new Limit(3, 20);

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Duration getMinuteWindow() {
        if (minuteWindow == null || minuteWindow.isZero() || minuteWindow.isNegative()) {
            return Duration.ofMinutes(1);
        }
        return minuteWindow;
    }

    public void setMinuteWindow(Duration minuteWindow) {
        this.minuteWindow = minuteWindow;
    }

    String normalizedMode() {
        String normalized = mode == null ? "" : mode.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? "in-memory" : normalized;
    }

    public Limit getExplain() {
        return explain;
    }

    public void setExplain(Limit explain) {
        this.explain = explain;
    }

    public Limit getDeck() {
        return deck;
    }

    public void setDeck(Limit deck) {
        this.deck = deck;
    }

    Limit limitFor(AiRateLimitAction action) {
        return action == AiRateLimitAction.DECK ? safe(deck, 3, 20) : safe(explain, 10, 100);
    }

    private Limit safe(Limit limit, int defaultPerMinute, int defaultPerDay) {
        if (limit == null) {
            return new Limit(defaultPerMinute, defaultPerDay);
        }
        return new Limit(
                Math.max(1, limit.getPerMinute()),
                Math.max(1, limit.getPerDay())
        );
    }

    public static class Limit {
        private int perMinute;
        private int perDay;

        public Limit() {
        }

        public Limit(int perMinute, int perDay) {
            this.perMinute = perMinute;
            this.perDay = perDay;
        }

        public int getPerMinute() {
            return perMinute;
        }

        public void setPerMinute(int perMinute) {
            this.perMinute = perMinute;
        }

        public int getPerDay() {
            return perDay;
        }

        public void setPerDay(int perDay) {
            this.perDay = perDay;
        }
    }
}
