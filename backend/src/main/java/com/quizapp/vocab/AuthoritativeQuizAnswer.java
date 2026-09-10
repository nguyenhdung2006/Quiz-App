package com.quizapp.vocab;

public record AuthoritativeQuizAnswer(
        VocabularyWord word,
        String questionMode,
        String prompt,
        String selectedAnswer,
        String correctAnswer
) {
}
