package com.quizapp.retention;

import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class LearningRetentionClock {
    private final Clock clock;

    public LearningRetentionClock() {
        this(Clock.systemUTC());
    }

    LearningRetentionClock(Clock clock) {
        this.clock = clock;
    }

    public Instant now() {
        return clock.instant();
    }
}
