package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import com.quizapp.user.CurrentUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
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
    WordDto create(@AuthenticationPrincipal OAuth2User principal, @Valid @RequestBody WordRequest request) {
        return vocabulary.createWord(currentUsers.requireUser(principal), request);
    }

    @PutMapping("/vocab/{id}")
    WordDto update(
            @AuthenticationPrincipal OAuth2User principal,
            @PathVariable Long id,
            @Valid @RequestBody WordRequest request
    ) {
        return vocabulary.updateWord(currentUsers.requireUser(principal), id, request);
    }

    @DeleteMapping("/vocab/{id}")
    void delete(@AuthenticationPrincipal OAuth2User principal, @PathVariable Long id) {
        vocabulary.deleteWord(currentUsers.requireUser(principal), id);
    }

    @DeleteMapping("/vocab/uid/{wordUid}")
    void deleteByUid(@AuthenticationPrincipal OAuth2User principal, @PathVariable UUID wordUid) {
        vocabulary.deleteWordByUid(currentUsers.requireUser(principal), wordUid);
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
    SyncResponse sync(@AuthenticationPrincipal OAuth2User principal, @Valid @RequestBody SyncRequest request) {
        return vocabulary.sync(currentUsers.requireUser(principal), request);
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
    SyncResponse importSampleWords(@AuthenticationPrincipal OAuth2User principal) {
        return vocabulary.importStarterWords(currentUsers.requireAdmin(principal));
    }

    @PostMapping("/quiz-results")
    SyncResponse quizResult(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody QuizResultRequest request
    ) {
        return vocabulary.recordQuizResult(currentUsers.requireUser(principal), request);
    }
}
