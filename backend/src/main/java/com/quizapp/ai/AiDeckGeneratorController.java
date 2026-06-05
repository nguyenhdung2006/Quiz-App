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
public class AiDeckGeneratorController {
    private final CurrentUserService currentUsers;
    private final AiDeckGeneratorService deckGenerator;

    public AiDeckGeneratorController(CurrentUserService currentUsers, AiDeckGeneratorService deckGenerator) {
        this.currentUsers = currentUsers;
        this.deckGenerator = deckGenerator;
    }

    @PostMapping("/generate-deck")
    GeneratedDeckResponse generateDeck(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody GenerateDeckRequest request
    ) {
        currentUsers.requireUser(principal);
        return deckGenerator.generateDeck(request);
    }
}
