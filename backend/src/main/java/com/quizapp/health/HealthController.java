package com.quizapp.health;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final HealthCounterService counters;

    public HealthController(HealthCounterService counters) {
        this.counters = counters;
    }

    @GetMapping("/api/health")
    Map<String, String> health() {
        return Map.of(
                "status", "ok",
                "app", "quiz-app"
        );
    }

    @GetMapping("/api/health/summary")
    Map<String, Object> summary() {
        Map<String, Object> result = new LinkedHashMap<>(counters.snapshot());
        result.put("status", "ok");
        result.put("app", "quiz-app");
        return result;
    }
}
