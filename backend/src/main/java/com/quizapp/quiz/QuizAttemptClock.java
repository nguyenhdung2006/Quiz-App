package com.quizapp.quiz;

import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class QuizAttemptClock {
    private final Clock clock;

    public QuizAttemptClock() {
        this(Clock.systemUTC());
    }

    QuizAttemptClock(Clock clock) {
        this.clock = clock;
    }

    public Instant now() {
        return clock.instant();
    }
}
