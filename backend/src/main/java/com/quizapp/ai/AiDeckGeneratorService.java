package com.quizapp.ai;

import com.quizapp.health.HealthCounterService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AiDeckGeneratorService {
    private static final Logger log = LoggerFactory.getLogger(AiDeckGeneratorService.class);

    private final AiDeckGeneratorClient aiClient;
    private final RuleBasedDeckGeneratorService fallback;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    public AiDeckGeneratorService(AiDeckGeneratorClient aiClient, RuleBasedDeckGeneratorService fallback) {
        this.aiClient = aiClient;
        this.fallback = fallback;
    }

    public GeneratedDeckResponse generateDeck(GenerateDeckRequest request) {
        if (!aiClient.isConfigured()) {
            log.info("[AI] OpenAI not configured, using fallback for deck generation");
            return fallback.generate(request);
        }

        try {
            log.info("[AI] Deck generation request start level={} maxWords={}",
                    request.normalizedTargetLevel(), request.normalizedMaxWords());
            List<GeneratedDeckWordDto> items = aiClient.generate(request);
            if (items == null) {
                log.warn("[AI] Deck generator returned null items, falling back to rule-based deck");
                if (healthCounters != null) healthCounters.incrementAiFailures();
                return fallback.generate(request);
            }
            log.info("[AI] Deck generation success itemsCount={} source=openai", items.size());
            return new GeneratedDeckResponse(items, "openai");
        } catch (RuntimeException exception) {
            log.warn("[AI] Deck generation failed will use fallback type={} message={}",
                    exception.getClass().getSimpleName(), exception.getMessage());
            if (healthCounters != null) healthCounters.incrementAiFailures();
            return fallback.generate(request);
        }
    }
}
