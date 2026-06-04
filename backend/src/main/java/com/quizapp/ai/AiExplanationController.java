package com.quizapp.ai;

import com.quizapp.user.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiExplanationController {
    private final CurrentUserService currentUsers;
    private final AiExplanationService aiExplanation;

    public AiExplanationController(CurrentUserService currentUsers, AiExplanationService aiExplanation) {
        this.currentUsers = currentUsers;
        this.aiExplanation = aiExplanation;
    }

    @PostMapping("/explain-wrong-answer")
    ExplainWrongAnswerResponse explainWrongAnswer(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody ExplainWrongAnswerRequest request
    ) {
        currentUsers.requireUser(principal);
        return aiExplanation.explainWrongAnswer(request);
    }
}
