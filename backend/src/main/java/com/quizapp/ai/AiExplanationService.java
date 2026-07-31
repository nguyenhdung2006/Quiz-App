package com.quizapp.ai;

import com.quizapp.health.HealthCounterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AiExplanationService {
    private static final Logger log = LoggerFactory.getLogger(AiExplanationService.class);

    private final AiExplanationClient aiClient;
    private final RuleBasedExplanationService fallback;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    public AiExplanationService(AiExplanationClient aiClient, RuleBasedExplanationService fallback) {
        this.aiClient = aiClient;
        this.fallback = fallback;
    }

    public ExplainWrongAnswerResponse explainWrongAnswer(ExplainWrongAnswerRequest request) {
        if (!aiClient.isConfigured()) {
            log.info("[AI] OpenAI not configured, using fallback for explanation");
            return fallback.explain(request);
        }

        try {
            log.info("[AI] Explanation request start");
            ExplainWrongAnswerResponse response = aiClient.explain(request);
            log.info("[AI] Explanation request success source={}", response.source());
            return response;
        } catch (RuntimeException exception) {
            log.warn("[AI] Explanation failed will use fallback type={} message={}",
                    exception.getClass().getSimpleName(), exception.getMessage());
            if (healthCounters != null) healthCounters.incrementAiFailures();
            return fallback.explain(request);
        }
    }
}
