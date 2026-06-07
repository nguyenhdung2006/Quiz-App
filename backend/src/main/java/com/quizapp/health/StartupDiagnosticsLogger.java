package com.quizapp.health;

import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class StartupDiagnosticsLogger {
    private static final Logger log = LoggerFactory.getLogger(StartupDiagnosticsLogger.class);

    private final Environment environment;
    private final boolean aiEnabled;
    private final boolean flywayEnabled;
    private final String serverPort;

    public StartupDiagnosticsLogger(
            Environment environment,
            @Value("${ai.openai.api-key:}") String openAiApiKey,
            @Value("${spring.flyway.enabled:false}") boolean flywayEnabled,
            @Value("${server.port:8080}") String serverPort
    ) {
        this.environment = environment;
        this.aiEnabled = openAiApiKey != null && !openAiApiKey.isBlank();
        this.flywayEnabled = flywayEnabled;
        this.serverPort = serverPort;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void logStartupSummary() {
        String profiles = Arrays.stream(environment.getActiveProfiles())
                .filter(profile -> profile != null && !profile.isBlank())
                .reduce((left, right) -> left + "," + right)
                .orElse("default");

        log.info(
                "WordArena backend started: profiles={}, port={}, aiEnabled={}, flywayEnabled={}",
                profiles,
                serverPort,
                aiEnabled,
                flywayEnabled
        );
    }
}
