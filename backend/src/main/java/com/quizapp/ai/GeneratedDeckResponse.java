package com.quizapp.ai;

import java.util.List;

public record GeneratedDeckResponse(
        List<GeneratedDeckWordDto> items,
        String source
) {
}
