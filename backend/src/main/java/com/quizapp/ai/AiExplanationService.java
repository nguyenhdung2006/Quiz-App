package com.quizapp.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiExplanationService {
    private static final Logger log = LoggerFactory.getLogger(AiExplanationService.class);

    private final AiExplanationClient aiClient;
    private final RuleBasedExplanationService fallback;

    public AiExplanationService(AiExplanationClient aiClient, RuleBasedExplanationService fallback) {
        this.aiClient = aiClient;
        this.fallback = fallback;
    }

    public ExplainWrongAnswerResponse explainWrongAnswer(ExplainWrongAnswerRequest request) {
        if (!aiClient.isConfigured()) {
            return fallback.explain(request);
        }

        try {
            return aiClient.explain(request);
        } catch (RuntimeException exception) {
            log.warn("AI explanation failed safely: {}", exception.getMessage());
            return fallback.explain(request);
        }
    }
}
