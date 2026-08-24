package com.quizapp.review;

import com.quizapp.user.CurrentUserService;
import com.quizapp.shared.RevisionedResult;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/review")
public class ReviewController {
    private static final String SYNC_REVISION_HEADER = "X-Sync-Revision";
    private final CurrentUserService currentUsers;
    private final SpacedRepetitionService spacedRepetition;

    public ReviewController(
            CurrentUserService currentUsers,
            SpacedRepetitionService spacedRepetition
    ) {
        this.currentUsers = currentUsers;
        this.spacedRepetition = spacedRepetition;
    }

    @GetMapping("/today")
    List<ReviewQueueItemDto> today(@AuthenticationPrincipal OAuth2User principal) {
        return spacedRepetition.today(currentUsers.requireUser(principal));
    }

    @GetMapping("/queue")
    List<ReviewQueueItemDto> queue(
            @AuthenticationPrincipal OAuth2User principal,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String level
    ) {
        return spacedRepetition.queue(currentUsers.requireUser(principal), limit, tag, level);
    }

    @PostMapping("/answer")
    ResponseEntity<ReviewAnswerResponse> answer(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody ReviewAnswerRequest request
    ) {
        return revisionResponse(spacedRepetition.answer(currentUsers.requireUser(principal), request));
    }

    @PostMapping("/known")
    ResponseEntity<ReviewAnswerResponse> markKnown(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody MarkKnownRequest request
    ) {
        return revisionResponse(spacedRepetition.markKnown(currentUsers.requireUser(principal), request));
    }

    private ResponseEntity<ReviewAnswerResponse> revisionResponse(
            RevisionedResult<ReviewAnswerResponse> result
    ) {
        return ResponseEntity.ok()
                .header(SYNC_REVISION_HEADER, String.valueOf(result.revision()))
                .body(result.body());
    }
}
