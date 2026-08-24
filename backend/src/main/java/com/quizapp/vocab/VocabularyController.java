package com.quizapp.vocab;

import com.quizapp.user.CurrentUserService;
import com.quizapp.shared.RevisionedResult;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class VocabularyController {
    private static final String SYNC_REVISION_HEADER = "X-Sync-Revision";
    private final CurrentUserService currentUsers;
    private final VocabularyService vocabulary;

    public VocabularyController(CurrentUserService currentUsers, VocabularyService vocabulary) {
        this.currentUsers = currentUsers;
        this.vocabulary = vocabulary;
    }

    @GetMapping("/vocab")
    List<WordDto> list(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.listWords(currentUsers.requireUser(principal));
    }

    @PostMapping("/vocab")
    ResponseEntity<WordDto> create(@AuthenticationPrincipal OAuth2User principal, @Valid @RequestBody WordRequest request) {
        return revisionResponse(vocabulary.createWord(currentUsers.requireUser(principal), request));
    }

    @PutMapping("/vocab/{id}")
    ResponseEntity<WordDto> update(
            @AuthenticationPrincipal OAuth2User principal,
            @PathVariable Long id,
            @Valid @RequestBody WordRequest request
    ) {
        return revisionResponse(vocabulary.updateWord(currentUsers.requireUser(principal), id, request));
    }

    @DeleteMapping("/vocab/{id}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal OAuth2User principal, @PathVariable Long id) {
        return revisionOnlyResponse(vocabulary.deleteWord(currentUsers.requireUser(principal), id));
    }

    @DeleteMapping("/vocab/uid/{wordUid}")
    ResponseEntity<Void> deleteByUid(@AuthenticationPrincipal OAuth2User principal, @PathVariable UUID wordUid) {
        return revisionOnlyResponse(vocabulary.deleteWordByUid(currentUsers.requireUser(principal), wordUid));
    }

    @GetMapping("/wrong-words")
    List<WordDto> wrongWords(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.listWrongWords(currentUsers.requireUser(principal));
    }

    @GetMapping("/snapshot")
    SyncResponse snapshot(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.snapshot(currentUsers.requireUser(principal));
    }

    @PostMapping("/sync")
    ResponseEntity<SyncResponse> sync(@AuthenticationPrincipal OAuth2User principal, @Valid @RequestBody SyncRequest request) {
        SyncResponse response = vocabulary.sync(currentUsers.requireUser(principal), request);
        return syncResponse(response);
    }

    @GetMapping("/progress")
    ProgressSummaryDto progress(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.snapshot(currentUsers.requireUser(principal)).progress();
    }

    @GetMapping("/achievements")
    List<AchievementDto> achievements(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.snapshot(currentUsers.requireUser(principal)).achievements();
    }

    @GetMapping("/quiz-history")
    List<QuizHistoryDto> quizHistory(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.snapshot(currentUsers.requireUser(principal)).quizHistory();
    }

    @PostMapping("/admin/sample-words")
    ResponseEntity<SyncResponse> importSampleWords(@AuthenticationPrincipal OAuth2User principal) {
        return syncResponse(vocabulary.importStarterWords(currentUsers.requireAdmin(principal)));
    }

    @PostMapping("/quiz-results")
    ResponseEntity<SyncResponse> quizResult(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody QuizResultRequest request
    ) {
        return syncResponse(vocabulary.recordQuizResult(currentUsers.requireUser(principal), request));
    }

    private <T> ResponseEntity<T> revisionResponse(RevisionedResult<T> result) {
        return ResponseEntity.ok()
                .header(SYNC_REVISION_HEADER, String.valueOf(result.revision()))
                .body(result.body());
    }

    private ResponseEntity<Void> revisionOnlyResponse(long revision) {
        return ResponseEntity.ok()
                .header(SYNC_REVISION_HEADER, String.valueOf(revision))
                .build();
    }

    private ResponseEntity<SyncResponse> syncResponse(SyncResponse response) {
        return ResponseEntity.ok()
                .header(SYNC_REVISION_HEADER, String.valueOf(response.revision()))
                .body(response);
    }
}
