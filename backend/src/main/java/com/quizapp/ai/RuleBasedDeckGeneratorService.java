package com.quizapp.ai;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class RuleBasedDeckGeneratorService {
    private static final Pattern WORD_PATTERN = Pattern.compile("[A-Za-z][A-Za-z'-]{2,}");
    private static final Pattern SENTENCE_SPLIT = Pattern.compile("(?<=[.!?])\\s+");
    private static final int MAX_ITEMS = 20;
    private static final Set<String> STOPWORDS = Set.of(
            "about", "after", "again", "also", "although", "always", "because", "before", "being",
            "between", "could", "every", "first", "from", "have", "into", "just", "like", "many",
            "more", "most", "only", "other", "people", "should", "some", "such", "than", "that",
            "their", "them", "then", "there", "these", "they", "this", "those", "through", "very",
            "were", "what", "when", "where", "which", "while", "with", "would", "your"
    );
    private static final Map<String, String> COMMON_MEANINGS = Map.ofEntries(
            Map.entry("assignment", "bài tập được giao"),
            Map.entry("attendance", "sự có mặt"),
            Map.entry("deadline", "hạn chót"),
            Map.entry("resilient", "kiên cường"),
            Map.entry("curious", "tò mò"),
            Map.entry("habit", "thói quen"),
            Map.entry("review", "ôn lại"),
            Map.entry("consistent", "nhất quán"),
            Map.entry("learners", "người học"),
            Map.entry("vocabulary", "từ vựng"),
            Map.entry("progress", "tiến bộ"),
            Map.entry("evidence", "bằng chứng"),
            Map.entry("compare", "so sánh"),
            Map.entry("focus", "tập trung"),
            Map.entry("database", "cơ sở dữ liệu"),
            Map.entry("deploy", "triển khai"),
            Map.entry("debug", "gỡ lỗi"),
            Map.entry("interface", "giao diện"),
            Map.entry("repository", "kho mã nguồn")
    );

    public GeneratedDeckResponse generate(GenerateDeckRequest request) {
        Map<String, Candidate> candidates = new LinkedHashMap<>();
        String[] sentences = SENTENCE_SPLIT.split(clean(request.text()));

        for (String sentence : sentences) {
            Matcher matcher = WORD_PATTERN.matcher(sentence);
            while (matcher.find()) {
                String raw = matcher.group();
                String key = raw.toLowerCase(Locale.ROOT);
                if (STOPWORDS.contains(key) || key.length() < 4) continue;

                Candidate candidate = candidates.computeIfAbsent(key, ignored -> new Candidate(raw, sentence));
                candidate.count++;
                if (candidate.example.isBlank() && !sentence.isBlank()) {
                    candidate.example = sentence.trim();
                }
            }
        }

        List<GeneratedDeckWordDto> items = candidates.values().stream()
                .sorted(Comparator.comparingInt((Candidate item) -> item.count).reversed()
                        .thenComparing(item -> item.word.toLowerCase(Locale.ROOT)))
                .limit(MAX_ITEMS)
                .map(this::toWord)
                .toList();

        return new GeneratedDeckResponse(items, "fallback");
    }

    private GeneratedDeckWordDto toWord(Candidate candidate) {
        return new GeneratedDeckWordDto(
                candidate.word,
                fallbackMeaning(candidate.word),
                guessPartOfSpeech(candidate.word),
                "A2",
                fallbackExample(candidate),
                "ai-deck",
                "fallback"
        );
    }

    private String fallbackMeaning(String word) {
        return COMMON_MEANINGS.getOrDefault(
                word.toLowerCase(Locale.ROOT),
                "Cần bổ sung nghĩa tiếng Việt"
        );
    }

    private String guessPartOfSpeech(String word) {
        String lower = word.toLowerCase(Locale.ROOT);
        if (lower.endsWith("ly")) return "adv";
        if (lower.endsWith("ing") || lower.endsWith("ed")) return "v";
        if (lower.endsWith("ive") || lower.endsWith("ous") || lower.endsWith("ful") || lower.endsWith("able")) return "adj";
        return "n";
    }

    private String fallbackExample(Candidate candidate) {
        String example = clean(candidate.example);
        if (!example.isBlank() && example.length() <= 240) {
            return example;
        }
        return "The word \"" + candidate.word + "\" appears in the pasted text.";
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static class Candidate {
        private final String word;
        private String example;
        private int count;

        private Candidate(String word, String example) {
            this.word = word;
            this.example = example == null ? "" : example.trim();
        }
    }
}
