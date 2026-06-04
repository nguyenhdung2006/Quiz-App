package com.quizapp.ai;

import org.springframework.stereotype.Service;

@Service
public class AiExplanationService {
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
            return fallback.explain(request);
        }
    }
}
