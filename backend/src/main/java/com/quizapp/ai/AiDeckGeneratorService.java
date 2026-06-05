package com.quizapp.ai;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AiDeckGeneratorService {
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
            if (items == null || items.isEmpty()) {
                return fallback.generate(request);
            }
            return new GeneratedDeckResponse(items, "openai");
        } catch (RuntimeException exception) {
            return fallback.generate(request);
        }
    }
}
