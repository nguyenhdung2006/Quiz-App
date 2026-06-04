package com.quizapp.ai;

public interface AiExplanationClient {
    boolean isConfigured();

    ExplainWrongAnswerResponse explain(ExplainWrongAnswerRequest request);
}
