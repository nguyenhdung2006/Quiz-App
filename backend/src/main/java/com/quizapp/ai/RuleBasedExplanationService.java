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
                "Ban chon \"" + userAnswer + "\", nhung dap an dung la \"" + correctAnswer
                        + "\". Hay kiem tra lai nghia chinh, ngu canh va loai tu truoc khi chon.",
                "Voi nhom " + tag + " o muc " + level + ", hay uu tien nho nghia cot loi cua \""
                        + word + "\" roi doi chieu voi cau hoi.",
                example,
                "Lien ket \"" + word + "\" voi mot tinh huong quen thuoc, sau do tu noi lai nghia tieng Viet truoc khi nhin dap an.",
                collocations(word),
                "Nham \"" + word + "\" voi mot tu gan nghia hoac chon theo cam giac thay vi kiem tra ngu canh.",
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
