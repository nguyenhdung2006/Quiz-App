package com.quizapp.quiz;

import com.quizapp.user.CurrentUserService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quiz/attempts")
public class QuizAttemptController {
    private static final String SYNC_REVISION_HEADER = "X-Sync-Revision";
    private final CurrentUserService currentUsers;
    private final QuizAttemptService attempts;

    public QuizAttemptController(CurrentUserService currentUsers, QuizAttemptService attempts) {
        this.currentUsers = currentUsers;
        this.attempts = attempts;
    }

    @PostMapping("")
    QuizAttemptResponse issue(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody CreateQuizAttemptRequest request
    ) {
        return attempts.issue(currentUsers.requireUser(principal), request);
    }

    @PostMapping("/{attemptId}/submit")
    ResponseEntity<QuizAttemptSubmitResponse> submit(
            @AuthenticationPrincipal OAuth2User principal,
            @PathVariable UUID attemptId,
            @Valid @RequestBody SubmitQuizAttemptRequest request
    ) {
        QuizAttemptSubmitResponse response = attempts.submit(
                currentUsers.requireUser(principal),
                attemptId,
                request
        );
        return ResponseEntity.ok()
                .header(SYNC_REVISION_HEADER, String.valueOf(response.snapshot().revision()))
                .body(response);
    }
}
