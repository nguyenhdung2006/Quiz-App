package com.quizapp.health;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.stereotype.Component;

@Component
public class WordArenaInfoContributor implements InfoContributor {
    private final boolean aiEnabled;
    private final boolean flywayEnabled;
    private final String rateLimitMode;

    public WordArenaInfoContributor(
            @Value("${ai.openai.api-key:}") String openAiApiKey,
            @Value("${spring.flyway.enabled:false}") boolean flywayEnabled,
            @Value("${ai.rate-limit.mode:in-memory}") String rateLimitMode
    ) {
        this.aiEnabled = openAiApiKey != null && !openAiApiKey.isBlank();
        this.flywayEnabled = flywayEnabled;
        this.rateLimitMode = rateLimitMode == null || rateLimitMode.isBlank()
                ? "in-memory"
                : rateLimitMode.trim();
    }

    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("ai", Map.of("enabled", aiEnabled));
        builder.withDetail("flyway", Map.of("enabled", flywayEnabled));
        builder.withDetail("rateLimit", Map.of(
                "mode", rateLimitMode,
                "distributed", false
        ));
    }
}
