package com.quizapp.ai;

import com.quizapp.user.CurrentUserService;
import com.quizapp.user.AppUser;
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
    private final AiRateLimitService rateLimits;

    public AiExplanationController(
            CurrentUserService currentUsers,
            AiExplanationService aiExplanation,
            AiRateLimitService rateLimits
    ) {
        this.currentUsers = currentUsers;
        this.aiExplanation = aiExplanation;
        this.rateLimits = rateLimits;
    }

    @PostMapping("/explain-wrong-answer")
    ExplainWrongAnswerResponse explainWrongAnswer(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody ExplainWrongAnswerRequest request
    ) {
        AppUser user = currentUsers.requireUser(principal);
        rateLimits.checkAllowed(user, AiRateLimitAction.EXPLAIN);
        return aiExplanation.explainWrongAnswer(request);
    }
}
