package com.quizapp.quiz;

import com.quizapp.user.AppUser;
import com.quizapp.vocab.AuthoritativeQuizAnswer;
import com.quizapp.vocab.AuthoritativeQuizResult;
import com.quizapp.vocab.SyncResponse;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyService;
import com.quizapp.vocab.VocabularyWord;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizAttemptService {
    static final Duration ATTEMPT_LIFETIME = Duration.ofHours(24);
    static final int MAX_ITEMS = 500;
    private static final Set<String> SUPPORTED_QUIZ_MODES = Set.of(
            "quiz", "challenge", "wrong-practice", "favorites", "daily", "mixed", "eng", "vie",
            "quick-add", "focus", "weak-words"
    );

    private final LearningAttemptRepository attempts;
    private final LearningAttemptItemRepository items;
    private final VocabularyRepository words;
    private final VocabularyService vocabulary;
    private final QuizAttemptClock clock;

    public QuizAttemptService(
            LearningAttemptRepository attempts,
            LearningAttemptItemRepository items,
            VocabularyRepository words,
            VocabularyService vocabulary,
            QuizAttemptClock clock
    ) {
        this.attempts = attempts;
        this.items = items;
        this.words = words;
        this.vocabulary = vocabulary;
        this.clock = clock;
    }

    @Transactional
    public QuizAttemptResponse issue(AppUser user, CreateQuizAttemptRequest request) {
        String quizMode = request.quizMode();
        if (!SUPPORTED_QUIZ_MODES.contains(quizMode)) {
            throw new IllegalArgumentException("Unsupported quiz mode.");
        }
        if (request.items().size() > MAX_ITEMS) {
            throw new IllegalArgumentException("Quiz attempt cannot include more than 500 items.");
        }

        List<Long> requestedWordIds = request.items().stream()
                .map(CreateQuizAttemptItemRequest::wordId)
                .toList();
        if (new HashSet<>(requestedWordIds).size() != requestedWordIds.size()) {
            throw new IllegalArgumentException("Duplicate words are not allowed within one quiz attempt.");
        }

        Map<Long, VocabularyWord> ownedWords = words.findByUserAndIdIn(user, requestedWordIds).stream()
                .collect(Collectors.toMap(VocabularyWord::getId, Function.identity()));
        if (ownedWords.size() != requestedWordIds.size()) {
            throw new IllegalArgumentException("Quiz word not found.");
        }

        Instant now = clock.now();
        LearningAttempt attempt = LearningAttempt.issue(
                UUID.randomUUID(),
                user,
                quizMode,
                request.challengeSeconds(),
                now,
                now.plus(ATTEMPT_LIFETIME)
        );
        attempts.save(attempt);

        List<LearningAttemptItem> issuedItems = new ArrayList<>(request.items().size());
        for (int ordinal = 0; ordinal < request.items().size(); ordinal++) {
            CreateQuizAttemptItemRequest requestedItem = request.items().get(ordinal);
            VocabularyWord word = ownedWords.get(requestedItem.wordId());
            String questionMode = requestedItem.questionMode();

            LearningAttemptItem item = new LearningAttemptItem();
            item.setAttempt(attempt);
            item.setUserId(user.getId());
            item.setWord(word);
            item.setWordUserId(user.getId());
            item.setOrdinal(ordinal);
            item.setQuestionMode(questionMode);
            item.setPrompt(promptFor(word, questionMode));
            item.setCorrectAnswer(correctAnswerFor(word, questionMode));
            issuedItems.add(item);
        }
        items.saveAll(issuedItems);

        return issuedResponse(attempt, issuedItems);
    }

    @Transactional
    public QuizAttemptSubmitResponse submit(
            AppUser user,
            UUID attemptId,
            SubmitQuizAttemptRequest request
    ) {
        LearningAttempt attempt = attempts.findOwnedByIdForUpdate(attemptId, user)
                .orElseThrow(() -> new IllegalArgumentException("Quiz attempt not found."));
        List<LearningAttemptItem> issuedItems = items.findByAttemptOrderByOrdinalAsc(attempt);
        Map<Integer, String> selections = validateSelections(issuedItems, request.answers());
        String fingerprint = fingerprint(selections);

        if (attempt.getStatus() == LearningAttemptStatus.CONSUMED) {
            if (!fingerprint.equals(attempt.getSubmissionFingerprint())) {
                throw new QuizAttemptConflictException(
                        "QUIZ_ATTEMPT_REPLAY_CONFLICT",
                        "Quiz attempt was already submitted with different answers."
                );
            }
            SyncResponse snapshot = vocabulary.snapshot(attempt.getUser());
            return submitResponse(attempt, true, snapshot);
        }

        if (attempt.getStatus() != LearningAttemptStatus.ISSUED) {
            throw new QuizAttemptConflictException(
                    "QUIZ_ATTEMPT_INVALID",
                    "Quiz attempt is in an invalid state."
            );
        }

        Instant now = clock.now();
        if (!now.isBefore(attempt.getExpiresAt())) {
            throw new QuizAttemptConflictException("QUIZ_ATTEMPT_EXPIRED", "Quiz attempt has expired.");
        }

        List<AuthoritativeQuizAnswer> answers = new ArrayList<>(issuedItems.size());
        for (LearningAttemptItem item : issuedItems) {
            VocabularyWord word = item.getWord();
            if (word == null
                    || word.getUser() == null
                    || !attempt.getUser().getId().equals(word.getUser().getId())
                    || !attempt.getUser().getId().equals(item.getUserId())
                    || !attempt.getUser().getId().equals(item.getWordUserId())) {
                throw new QuizAttemptConflictException(
                        "QUIZ_ATTEMPT_INVALID",
                        "Quiz attempt can no longer be submitted."
                );
            }
            answers.add(new AuthoritativeQuizAnswer(
                    word,
                    item.getQuestionMode(),
                    item.getPrompt(),
                    selections.get(item.getOrdinal()),
                    item.getCorrectAnswer()
            ));
        }

        AuthoritativeQuizResult result = vocabulary.recordIssuedQuizResult(
                attempt.getUser(),
                attempt.getQuizMode(),
                attempt.getChallengeSeconds(),
                answers
        );
        attempt.consume(
                now,
                fingerprint,
                result.resultingRevision(),
                result.history(),
                result.awardedQuizXp(),
                result.awardedAchievementXp(),
                result.totalQuestions(),
                result.correctAnswers(),
                result.wrongAnswers(),
                result.score(),
                result.maxCombo()
        );
        attempts.save(attempt);

        return submitResponse(attempt, false, result.snapshot());
    }

    private Map<Integer, String> validateSelections(
            List<LearningAttemptItem> issuedItems,
            List<QuizAttemptSelectionRequest> submittedAnswers
    ) {
        if (issuedItems.isEmpty()) {
            throw new QuizAttemptConflictException(
                    "QUIZ_ATTEMPT_INVALID",
                    "Quiz attempt has no issued items."
            );
        }
        if (submittedAnswers.size() != issuedItems.size()) {
            throw new IllegalArgumentException("Quiz submission must answer every issued item exactly once.");
        }

        Set<Integer> issuedOrdinals = issuedItems.stream()
                .map(LearningAttemptItem::getOrdinal)
                .collect(Collectors.toSet());
        Map<Integer, String> selections = new HashMap<>();
        for (QuizAttemptSelectionRequest answer : submittedAnswers) {
            if (selections.containsKey(answer.ordinal())) {
                throw new IllegalArgumentException("Duplicate quiz item ordinal.");
            }
            selections.put(answer.ordinal(), answer.selectedAnswer());
            if (!issuedOrdinals.contains(answer.ordinal())) {
                throw new IllegalArgumentException("Quiz submission contains an item that was not issued.");
            }
        }
        return issuedItems.stream().collect(Collectors.toMap(
                LearningAttemptItem::getOrdinal,
                item -> selections.get(item.getOrdinal()),
                (left, right) -> left,
                LinkedHashMap::new
        ));
    }

    private String fingerprint(Map<Integer, String> selections) {
        StringBuilder canonical = new StringBuilder();
        selections.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    String answer = normalizeAnswer(entry.getValue());
                    canonical.append(entry.getKey())
                            .append(':')
                            .append(answer.length())
                            .append(':')
                            .append(answer)
                            .append(';');
                });
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonical.toString().getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private QuizAttemptResponse issuedResponse(
            LearningAttempt attempt,
            List<LearningAttemptItem> issuedItems
    ) {
        return new QuizAttemptResponse(
                attempt.getId(),
                attempt.getQuizMode(),
                attempt.getChallengeSeconds(),
                attempt.getCreatedAt(),
                attempt.getExpiresAt(),
                issuedItems.stream().map(item -> new QuizAttemptItemResponse(
                        item.getOrdinal(),
                        item.getWord().getId(),
                        item.getWord().getWordUid(),
                        item.getQuestionMode(),
                        item.getPrompt()
                )).toList()
        );
    }

    private QuizAttemptSubmitResponse submitResponse(
            LearningAttempt attempt,
            boolean replayed,
            SyncResponse snapshot
    ) {
        Long historyId = attempt.getQuizHistory() == null ? null : attempt.getQuizHistory().getId();
        QuizAttemptOutcomeDto outcome = new QuizAttemptOutcomeDto(
                historyId,
                attempt.getResultTotalQuestions(),
                attempt.getResultCorrectAnswers(),
                attempt.getResultWrongAnswers(),
                attempt.getResultScore(),
                attempt.getResultMaxCombo(),
                attempt.getAwardedQuizXp(),
                attempt.getAwardedAchievementXp(),
                attempt.getResultingSyncRevision()
        );
        return new QuizAttemptSubmitResponse(attempt.getId(), replayed, outcome, snapshot);
    }

    private String promptFor(VocabularyWord word, String questionMode) {
        return "eng".equals(questionMode) ? word.getEng() : word.getVie();
    }

    private String correctAnswerFor(VocabularyWord word, String questionMode) {
        return "eng".equals(questionMode) ? word.getVie() : word.getEng();
    }

    private String normalizeAnswer(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
