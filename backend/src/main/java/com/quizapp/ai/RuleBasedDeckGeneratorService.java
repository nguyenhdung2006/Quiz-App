package com.quizapp.ai;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class RuleBasedDeckGeneratorService {
    private static final Pattern SENTENCE_SPLIT = Pattern.compile("(?<=[.!?])\\s+");
    private static final Map<String, Term> TERMS = terms();

    public GeneratedDeckResponse generate(GenerateDeckRequest request) {
        String text = clean(request.text());
        String targetLevel = request.normalizedTargetLevel();
        int maxWords = request.normalizedMaxWords();
        List<GeneratedDeckWordDto> items = new ArrayList<>();

        for (Term term : TERMS.values()) {
            if (request.hasSpecificTargetLevel() && !term.level().equals(targetLevel)) {
                continue;
            }
            if (!appearsInText(text, term.english())) {
                continue;
            }
            items.add(toWord(term, text));
            if (items.size() >= maxWords) {
                break;
            }
        }

        return new GeneratedDeckResponse(items, "fallback");
    }

    private GeneratedDeckWordDto toWord(Term term, String sourceText) {
        return new GeneratedDeckWordDto(
                term.english(),
                term.vietnameseMeaning(),
                term.partOfSpeech(),
                term.level(),
                sourceSentence(sourceText, term.english()),
                term.tag(),
                "fallback"
        );
    }

    private boolean appearsInText(String text, String term) {
        if (text.isBlank() || term.isBlank()) {
            return false;
        }
        return Pattern.compile("\\b" + Pattern.quote(term) + "\\b", Pattern.CASE_INSENSITIVE)
                .matcher(text)
                .find();
    }

    private String sourceSentence(String text, String term) {
        String[] sentences = SENTENCE_SPLIT.split(text);
        for (String sentence : sentences) {
            String clean = clean(sentence);
            if (appearsInText(clean, term)) {
                return clean.length() <= 240 ? clean : clean.substring(0, 237) + "...";
            }
        }
        return text.length() <= 240 ? text : text.substring(0, 237) + "...";
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private static Map<String, Term> terms() {
        Map<String, Term> terms = new LinkedHashMap<>();
        add(terms, "assignment", "bài tập được giao", "n", "A2", "school");
        add(terms, "attendance", "sự có mặt", "n", "A2", "school");
        add(terms, "deadline", "hạn chót", "n", "A2", "school");
        add(terms, "habit", "thói quen", "n", "A2", "learning");
        add(terms, "review", "ôn lại", "v", "A2", "learning");
        add(terms, "focus", "tập trung", "v", "A2", "learning");
        add(terms, "regularly", "một cách đều đặn", "adv", "A2", "learning");
        add(terms, "comfortable", "thoải mái", "adj", "A2", "general");

        add(terms, "improve", "cải thiện", "v", "B1", "learning");
        add(terms, "knowledge", "kiến thức", "n", "B1", "learning");
        add(terms, "reduce", "giảm bớt", "v", "B1", "general");
        add(terms, "avoid", "tránh", "v", "B1", "general");
        add(terms, "although", "mặc dù", "conj", "B1", "academic");
        add(terms, "entertainment", "sự giải trí", "n", "B1", "general");
        add(terms, "develop", "phát triển", "v", "B1", "academic");
        add(terms, "compare", "so sánh", "v", "B1", "academic");
        add(terms, "interface", "giao diện", "n", "B1", "technology");
        add(terms, "database", "cơ sở dữ liệu", "n", "B1", "technology");
        add(terms, "deploy", "triển khai", "v", "B1", "technology");
        add(terms, "debug", "gỡ lỗi", "v", "B1", "technology");
        add(terms, "repository", "kho mã nguồn", "n", "B1", "technology");

        add(terms, "critical thinking", "tư duy phản biện", "n", "B2", "academic");
        add(terms, "concentration", "sự tập trung", "n", "B2", "learning");
        add(terms, "distraction", "yếu tố gây xao nhãng", "n", "B2", "learning");
        add(terms, "academic", "mang tính học thuật", "adj", "B2", "academic");
        add(terms, "significant", "đáng kể", "adj", "B2", "academic");
        add(terms, "evidence", "bằng chứng", "n", "B2", "academic");
        add(terms, "consequence", "hậu quả", "n", "B2", "academic");
        add(terms, "beneficial", "có lợi", "adj", "B2", "academic");
        add(terms, "whereas", "trong khi đó", "conj", "B2", "academic");
        add(terms, "resilient", "kiên cường", "adj", "B2", "mindset");

        add(terms, "mitigate", "giảm thiểu", "v", "C1", "academic");
        add(terms, "sophisticated", "tinh vi", "adj", "C1", "academic");
        add(terms, "ambiguous", "mơ hồ", "adj", "C1", "academic");
        add(terms, "substantial", "đáng kể", "adj", "C1", "academic");
        add(terms, "integrate", "tích hợp", "v", "C1", "technology");
        add(terms, "comprehensive", "toàn diện", "adj", "C1", "academic");

        add(terms, "ubiquitous", "phổ biến khắp nơi", "adj", "C2", "academic");
        add(terms, "meticulous", "tỉ mỉ", "adj", "C2", "academic");
        add(terms, "paradigm", "hệ hình", "n", "C2", "academic");
        add(terms, "nuanced", "có nhiều sắc thái", "adj", "C2", "academic");
        return terms;
    }

    private static void add(Map<String, Term> terms, String english, String meaning, String pos, String level, String tag) {
        terms.put(english.toLowerCase(Locale.ROOT), new Term(english, meaning, pos, level, tag));
    }

    private record Term(
            String english,
            String vietnameseMeaning,
            String partOfSpeech,
            String level,
            String tag
    ) {
    }
}
