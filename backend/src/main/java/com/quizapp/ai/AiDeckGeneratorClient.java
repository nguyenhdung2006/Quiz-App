package com.quizapp.ai;

import java.util.List;

public interface AiDeckGeneratorClient {
    boolean isConfigured();

    List<GeneratedDeckWordDto> generate(GenerateDeckRequest request);
}
