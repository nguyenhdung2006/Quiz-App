package com.quizapp.ai;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiDeckGeneratorService {
    private static final Logger log = LoggerFactory.getLogger(AiDeckGeneratorService.class);

    private final AiDeckGeneratorClient aiClient;
    private final RuleBasedDeckGeneratorService fallback;

    public AiDeckGeneratorService(AiDeckGeneratorClient aiClient, RuleBasedDeckGeneratorService fallback) {
        this.aiClient = aiClient;
        this.fallback = fallback;
    }

    public GeneratedDeckResponse generateDeck(GenerateDeckRequest request) {
        if (!aiClient.isConfigured()) {
            return fallback.generate(request);
        }

        try {
            List<GeneratedDeckWordDto> items = aiClient.generate(request);
            if (items == null) {
                log.warn("AI deck generator returned null items. Falling back to rule-based deck.");
                return fallback.generate(request);
            }
            return new GeneratedDeckResponse(items, "openai");
        } catch (RuntimeException exception) {
            log.warn("AI deck generation failed safely: {}", exception.getMessage());
            return fallback.generate(request);
        }
    }
}
