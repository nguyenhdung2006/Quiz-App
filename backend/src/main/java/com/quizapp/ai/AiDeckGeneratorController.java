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
public class AiDeckGeneratorController {
    private final CurrentUserService currentUsers;
    private final AiDeckGeneratorService deckGenerator;
    private final AiRateLimitService rateLimits;

    public AiDeckGeneratorController(
            CurrentUserService currentUsers,
            AiDeckGeneratorService deckGenerator,
            AiRateLimitService rateLimits
    ) {
        this.currentUsers = currentUsers;
        this.deckGenerator = deckGenerator;
        this.rateLimits = rateLimits;
    }

    @PostMapping("/generate-deck")
    GeneratedDeckResponse generateDeck(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody GenerateDeckRequest request
    ) {
        AppUser user = currentUsers.requireUser(principal);
        rateLimits.checkAllowed(user, AiRateLimitAction.DECK);
        return deckGenerator.generateDeck(request);
    }
}
