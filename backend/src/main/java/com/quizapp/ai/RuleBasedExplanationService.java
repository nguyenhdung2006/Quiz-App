package com.quizapp.ai;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RuleBasedExplanationService {

    ExplainWrongAnswerResponse explain(ExplainWrongAnswerRequest request) {
        String word = clean(request.word(), "this word");
        String correctAnswer = clean(request.correctAnswer(), "the correct answer");
        String userAnswer = clean(request.userAnswer(), "your answer");
        String tag = clean(request.tag(), "general vocabulary");
        String level = clean(request.level(), "current level");
        String example = clean(request.example(), "Try using \"" + word + "\" in one short English sentence.");

        return new ExplainWrongAnswerResponse(
                word,
                correctAnswer,
                "Bạn chọn \"" + userAnswer + "\", nhưng đáp án đúng là \"" + correctAnswer
                        + "\". Hãy kiểm tra lại nghĩa chính, ngữ cảnh và loại từ trước khi chọn.",
                "Với nhóm " + tag + " ở mức " + level + ", hãy ưu tiên nhớ nghĩa cốt lõi của \""
                        + word + "\" rồi đối chiếu với câu hỏi.",
                example,
                "Liên kết \"" + word + "\" với một tình huống quen thuộc, sau đó tự nói lại nghĩa tiếng Việt trước khi nhìn đáp án.",
                collocations(word),
                "Nhầm \"" + word + "\" với một từ gần nghĩa hoặc chọn theo cảm giác thay vì kiểm tra ngữ cảnh.",
                "fallback"
        );
    }

    private List<String> collocations(String word) {
        List<String> values = new ArrayList<>();
        values.add(word + " in context");
        values.add("use " + word + " correctly");
        return values;
    }

    private String clean(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
