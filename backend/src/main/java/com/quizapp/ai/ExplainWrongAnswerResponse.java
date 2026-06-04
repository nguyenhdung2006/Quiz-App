package com.quizapp.ai;

import java.util.List;

public record ExplainWrongAnswerResponse(
        String word,
        String shortMeaning,
        String whyWrong,
        String correctUsage,
        String example,
        String memoryTip,
        List<String> collocations,
        String commonMistake,
        String source
) {
}
