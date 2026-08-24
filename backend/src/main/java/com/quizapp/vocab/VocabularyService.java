package com.quizapp.vocab;

import com.quizapp.health.HealthCounterService;
import com.quizapp.shared.RevisionedResult;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {
    private static final Logger log = LoggerFactory.getLogger(VocabularyService.class);
    private final VocabularyRepository words;
    private final WrongBankRepository wrongBank;
    private final QuizHistoryRepository quizHistory;
    private final AchievementService achievements;
    private final LearningProgressService progress;
    private final AppUserRepository users;
    private final WordTombstoneRepository tombstones;
    private final SyncService syncService;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    private static final List<WordRequest> STARTER_WORDS = List.of(
            starter("resilient", "kien cuong", "adj", "mindset"),
            starter("curious", "to mo", "adj", "mindset"),
            starter("focus", "tap trung", "v", "study"),
            starter("review", "on lai", "v", "study"),
            starter("progress", "tien bo", "n", "study"),
            starter("attempt", "co gang thu", "v", "exam"),
            starter("evidence", "bang chung", "n", "exam"),
            starter("compare", "so sanh", "v", "exam"),
            starter("habit", "thoi quen", "n", "daily"),
            starter("calm", "binh tinh", "adj", "daily")
    );

    public VocabularyService(
            VocabularyRepository words,
            WrongBankRepository wrongBank,
            QuizHistoryRepository quizHistory,
            AchievementService achievements,
            LearningProgressService progress,
            AppUserRepository users,
            WordTombstoneRepository tombstones,
            SyncService syncService
    ) {
        this.words = words;
        this.wrongBank = wrongBank;
        this.quizHistory = quizHistory;
        this.achievements = achievements;
        this.progress = progress;
        this.users = users;
        this.tombstones = tombstones;
        this.syncService = syncService;
    }

    @Transactional(readOnly = true)
    public List<WordDto> listWords(AppUser user) {
        return words.findByUserOrderByCreatedAtDesc(user).stream().map(WordDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<WordDto> listWrongWords(AppUser user) {
        return wrongBank.findByUserOrderByCreatedAtDesc(user).stream()
                .map(entry -> WordDto.from(entry.getWord()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProgressSummaryDto progress(AppUser user) {
        return progress.progress(user, Math.toIntExact(achievements.countUnlocked(user)));
    }

    @Transactional
    public RevisionedResult<WordDto> createWord(AppUser user, WordRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        String normalizedEng = normalizeEnglishForStorage(request.eng());
        ensureNoDuplicateEnglish(syncUser, normalizedEng, null);
        if (request.wordUid() != null) {
            if (tombstones.existsByUserAndWordUid(syncUser, request.wordUid())) {
                throw new IllegalArgumentException("Deleted wordUid cannot be reused.");
            }
            words.findByUserAndWordUid(syncUser, request.wordUid()).ifPresent(existing -> {
                throw new IllegalArgumentException("wordUid already exists.");
            });
        }

        VocabularyWord word = new VocabularyWord();
        word.setUser(syncUser);
        applyWordRequest(word, request);
        VocabularyWord createdWord = words.save(word);
        if (words.findByUserOrderByCreatedAtDesc(syncUser).size() == 1) {
            achievements.unlock(syncUser, "FIRST_WORD");
        }
        long revision = markCloudChanged(syncUser);
        WordDto created = WordDto.from(createdWord);
        log.info("[SYNC] Word created userId={} wordId={}", syncUser.getId(), created.id());
        return new RevisionedResult<>(created, revision);
    }

    @Transactional
    public RevisionedResult<WordDto> updateWord(AppUser user, Long id, WordRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        VocabularyWord word = words.findByIdAndUser(id, syncUser)
                .orElseThrow(() -> new IllegalArgumentException("Word not found."));
        String normalizedEng = normalizeEnglishForStorage(request.eng());
        ensureNoDuplicateEnglish(syncUser, normalizedEng, id);

        applyWordRequest(word, request);
        VocabularyWord updatedWord = words.save(word);
        long revision = markCloudChanged(syncUser);
        WordDto updated = WordDto.from(updatedWord);
        log.info("[SYNC] Word updated userId={} wordId={}", syncUser.getId(), id);
        return new RevisionedResult<>(updated, revision);
    }

    @Transactional
    public long deleteWord(AppUser user, Long id) {
        return syncService.deleteWord(user, id);
    }

    @Transactional
    public long deleteWordByUid(AppUser user, java.util.UUID wordUid) {
        return syncService.deleteWordByUid(user, wordUid);
    }

    @Transactional
    public SyncResponse importStarterWords(AppUser user) {
        AppUser syncUser = lockUserForRevision(user);
        log.info("[SNAPSHOT] Importing starter words userId={}", syncUser.getId());
        for (WordRequest word : STARTER_WORDS) {
            upsertByEnglish(syncUser, word);
        }
        achievements.unlock(syncUser, "FIRST_WORD");
        markCloudChanged(syncUser);
        log.info("[SNAPSHOT] Starter words imported successfully userId={}", syncUser.getId());
        return snapshot(syncUser);
    }

    @Transactional
    public SyncResponse sync(AppUser user, SyncRequest request) {
        return syncService.sync(user, request);
    }

    @Transactional
    public SyncResponse recordQuizResult(AppUser user, QuizResultRequest request) {
        if (request.answers() == null) return snapshot(user);
        AppUser syncUser = lockUserForRevision(user);
        log.info("[QUIZ] Recording quiz result userId={} mode={} total={} correct={}",
                syncUser.getId(), request.quizMode(), request.totalQuestions(), request.correctAnswers());
        try {
            QuizHistory history = new QuizHistory();
            history.setUser(syncUser);
            history.setQuizMode(defaultText(request.quizMode(), "mixed"));
            history.setChallengeSeconds(request.challengeSeconds());
            int verifiedTotal = 0;
            int verifiedCorrect = 0;
            int verifiedMaxCombo = 0;
            int currentCombo = 0;
            Map<String, VocabularyWord> wordsByEnglish = quizWordsByEnglish(syncUser, request.answers());
            Map<Long, WrongBankEntry> wrongEntriesByWordId = wrongEntriesByWordId(syncUser, wordsByEnglish.values());

            for (QuizAnswerRequest answer : request.answers()) {
                if (answer.eng() == null || answer.eng().isBlank()) continue;

                VocabularyWord word = wordsByEnglish.get(englishLookupKey(answer.eng()));
                if (word == null) continue;

                String questionMode = normalizeQuestionMode(answer.questionMode());
                String serverCorrectAnswer = correctAnswerFor(word, questionMode);
                boolean answerIsCorrect = answersMatch(answer.selectedAnswer(), serverCorrectAnswer);
                verifiedTotal++;
                if (answerIsCorrect) {
                    verifiedCorrect++;
                    currentCombo++;
                    verifiedMaxCombo = Math.max(verifiedMaxCombo, currentCombo);
                } else {
                    currentCombo = 0;
                }

                applyVerifiedAnswer(
                        syncUser,
                        history,
                        word,
                        answer,
                        questionMode,
                        serverCorrectAnswer,
                        answerIsCorrect,
                        wrongEntriesByWordId
                );
            }

            int verifiedWrong = verifiedTotal - verifiedCorrect;
            history.setTotalQuestions(verifiedTotal);
            history.setCorrectAnswers(verifiedCorrect);
            history.setWrongAnswers(verifiedWrong);
            history.setScore(scoreFor(verifiedCorrect, verifiedTotal));
            history.setMaxCombo(verifiedMaxCombo);

            quizHistory.save(history);

            int earnedXp = quizXp(verifiedCorrect, verifiedTotal, verifiedMaxCombo);
            syncUser.setXp(syncUser.getXp() + earnedXp);
            syncUser.setLevel(Math.max(1, syncUser.getXp() / 250 + 1));
            syncUser.setBestStreak(Math.max(syncUser.getBestStreak(), verifiedMaxCombo));

            if (verifiedTotal > 0) {
                achievements.unlock(syncUser, "FIRST_QUIZ");
            }
            if (verifiedTotal > 0 && verifiedCorrect == verifiedTotal) {
                achievements.unlock(syncUser, "PERFECT_ROUND");
            }
            if (verifiedMaxCombo >= 10) {
                achievements.unlock(syncUser, "COMBO_10");
            }
            if (verifiedTotal > 0 && "daily".equalsIgnoreCase(defaultText(request.quizMode(), ""))) {
                achievements.unlock(syncUser, "DAILY_CHALLENGE");
            }

            markCloudChanged(syncUser);
            SyncResponse result = snapshot(syncUser);
            log.info("[QUIZ] Quiz result recorded successfully userId={} earnedXp={}", syncUser.getId(), earnedXp);
            return result;
        } catch (RuntimeException ex) {
            log.error("[QUIZ] Quiz recording failed userId={} type={} message={}",
                    syncUser.getId(), ex.getClass().getSimpleName(), ex.getMessage());
            if (healthCounters != null) healthCounters.incrementQuizFailures();
            throw ex;
        }
    }

    private void applyVerifiedAnswer(
            AppUser user,
            QuizHistory history,
            VocabularyWord word,
            QuizAnswerRequest answer,
            String questionMode,
            String serverCorrectAnswer,
            boolean answerIsCorrect,
            Map<Long, WrongBankEntry> wrongEntriesByWordId
    ) {
        WordStats stats = ensureStats(word);
        stats.setSeen(stats.getSeen() + 1);
        stats.setLastReviewed(Instant.now());

        if (answerIsCorrect) {
            stats.setCorrect(stats.getCorrect() + 1);
            stats.setCurrentStreak(stats.getCurrentStreak() + 1);
            stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
            stats.setMasteryLevel(Math.min(5, stats.getMasteryLevel() + 1));
        } else {
            stats.setWrong(stats.getWrong() + 1);
            stats.setCurrentStreak(0);
            stats.setMasteryLevel(Math.max(0, stats.getMasteryLevel() - 1));
            word.setMastered(false);
            WrongBankEntry entry = wrongEntriesByWordId.computeIfAbsent(word.getId(), ignored -> {
                WrongBankEntry next = new WrongBankEntry();
                next.setUser(user);
                next.setWord(word);
                return next;
            });
            entry.setMastered(false);
            wrongBank.save(entry);
        }

        word.setMastered(stats.getCurrentStreak() >= 5);
        if (word.isMastered()) {
            stats.setMasteryLevel(5);
        }

        WrongBankEntry existingWrongEntry = wrongEntriesByWordId.get(word.getId());
        if (existingWrongEntry != null) {
            existingWrongEntry.setMastered(word.isMastered());
            wrongBank.save(existingWrongEntry);
        }

        stats.setNextReview(progress.nextReview(stats, answerIsCorrect));

        QuizHistoryAnswer savedAnswer = new QuizHistoryAnswer();
        savedAnswer.setWord(word);
        savedAnswer.setQuestionMode(questionMode);
        savedAnswer.setPrompt(promptFor(word, questionMode));
        savedAnswer.setSelectedAnswer(trim(answer.selectedAnswer()));
        savedAnswer.setCorrectAnswer(serverCorrectAnswer);
        savedAnswer.setCorrect(answerIsCorrect);
        history.addAnswer(savedAnswer);
    }

    private Map<String, VocabularyWord> quizWordsByEnglish(AppUser user, List<QuizAnswerRequest> answers) {
        List<String> englishKeys = answers.stream()
                .filter(answer -> answer != null && answer.eng() != null && !answer.eng().isBlank())
                .map(answer -> englishLookupKey(answer.eng()))
                .distinct()
                .toList();
        if (englishKeys.isEmpty()) {
            return Map.of();
        }

        return words.findByUserAndEnglishLookupKeyIn(user, englishKeys).stream()
                .collect(Collectors.toMap(
                        word -> englishLookupKey(word.getEng()),
                        Function.identity(),
                        (left, right) -> left
                ));
    }

    private Map<Long, WrongBankEntry> wrongEntriesByWordId(
            AppUser user,
            Collection<VocabularyWord> answerWords
    ) {
        List<VocabularyWord> persistedWords = answerWords.stream()
                .filter(word -> word.getId() != null)
                .toList();
        if (persistedWords.isEmpty()) {
            return new HashMap<>();
        }

        return wrongBank.findByUserAndWordIn(user, persistedWords).stream()
                .collect(Collectors.toMap(
                        entry -> entry.getWord().getId(),
                        Function.identity(),
                        (left, right) -> left,
                        HashMap::new
                ));
    }

    @Transactional(readOnly = true)
    public SyncResponse snapshot(AppUser user) {
        return syncService.snapshot(user);
    }

    private AppUser lockUserForRevision(AppUser user) {
        if (user == null || user.getId() == null) {
            throw new IllegalStateException("Authentication is required.");
        }
        return users.findByIdForSyncUpdate(user.getId())
                .orElseThrow(() -> new IllegalStateException("User not found."));
    }

    private long markCloudChanged(AppUser user) {
        return user.incrementSyncRevision();
    }

    private VocabularyWord upsertByEnglish(AppUser user, WordRequest request) {
        String normalizedEng = normalizeEnglishForStorage(request.eng());
        VocabularyWord word = findByNormalizedEnglish(user, normalizedEng)
                .orElseGet(() -> {
                    VocabularyWord created = new VocabularyWord();
                    created.setUser(user);
                    return created;
                });
        applyWordRequest(word, request);
        return words.save(word);
    }

    private void applyWordRequest(VocabularyWord word, WordRequest request) {
        String eng = normalizeEnglishForStorage(request.eng());
        String vie = trim(request.vie());
        if (eng.isBlank() || vie.isBlank()) {
            throw new IllegalArgumentException("English and Vietnamese are required.");
        }

        word.setWordUid(request.wordUid());
        word.setEng(eng);
        word.setVie(vie);
        word.setPos(defaultText(request.pos(), "n"));
        word.setTag(trim(request.tag()));
        word.setIpa(trim(request.ipa()));
        word.setLevel(defaultText(request.level(), "A1"));
        word.setContext(trim(request.context()));
        word.setExample(trim(request.example()));
        word.setExampleMeaning(trim(request.exampleMeaning()));
        word.setCollocation(trim(request.collocation()));
        word.setSynonyms(trim(request.synonyms()));
        word.setAntonyms(trim(request.antonyms()));
        word.setCommonMistake(trim(request.commonMistake()));
        word.setNote(trim(request.note()));
        word.setFavorite(request.favorite());
        ensureStats(word);
    }

    private void ensureNoDuplicateEnglish(AppUser user, String normalizedEng, Long currentWordId) {
        if (normalizedEng.isBlank()) return;

        findByNormalizedEnglish(user, normalizedEng)
                .filter(existing -> currentWordId == null || !existing.getId().equals(currentWordId))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Word already exists.");
                });
    }

    private java.util.Optional<VocabularyWord> findByNormalizedEnglish(AppUser user, String normalizedEng) {
        if (normalizedEng.isBlank()) {
            return java.util.Optional.empty();
        }

        String normalizedKey = englishLookupKey(normalizedEng);
        return words.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(word -> englishLookupKey(word.getEng()).equals(normalizedKey))
                .findFirst();
    }

    private String normalizeEnglishForStorage(String value) {
        return trim(value).replaceAll("\\s+", " ");
    }

    private String englishLookupKey(String value) {
        return normalizeEnglishForStorage(value).toLowerCase(Locale.ROOT);
    }

    private WordStats ensureStats(VocabularyWord word) {
        WordStats stats = word.getStats();
        if (stats == null) {
            stats = new WordStats();
            word.setStats(stats);
        }
        return stats;
    }

    private static WordRequest starter(String eng, String vie, String pos, String tag) {
        String level = switch (tag) {
            case "exam" -> "B1";
            case "mindset", "study", "daily" -> "A2";
            default -> "A1";
        };
        String ipa = switch (eng) {
            case "resilient" -> "/ri-ZIL-yuhnt/";
            case "curious" -> "/KYUR-ee-uhs/";
            case "focus" -> "/FOH-kuhs/";
            case "review" -> "/ri-VYOO/";
            case "progress" -> "/PRAH-gres/";
            case "attempt" -> "/uh-TEMPT/";
            case "evidence" -> "/EV-i-duhns/";
            case "compare" -> "/kuhm-PAIR/";
            case "habit" -> "/HAB-it/";
            case "calm" -> "/kahm/";
            default -> "";
        };
        String example = switch (eng) {
            case "resilient" -> "She stayed resilient after the hard exam.";
            case "curious" -> "A curious learner asks better questions.";
            case "focus" -> "Focus on one small step first.";
            case "review" -> "Review the hard words tomorrow.";
            case "progress" -> "Small progress still counts.";
            case "attempt" -> "Attempt every question calmly.";
            case "evidence" -> "Use evidence to support your answer.";
            case "compare" -> "Compare the two ideas clearly.";
            case "habit" -> "A tiny habit can become powerful.";
            case "calm" -> "Stay calm before answering.";
            default -> "";
        };
        String collocation = switch (eng) {
            case "resilient" -> "resilient learner, remain resilient";
            case "curious" -> "curious about, curious learner";
            case "focus" -> "focus on, stay focused";
            case "review" -> "review notes, review vocabulary";
            case "progress" -> "make progress, steady progress";
            case "attempt" -> "attempt a question, first attempt";
            case "evidence" -> "strong evidence, provide evidence";
            case "compare" -> "compare A with B";
            case "habit" -> "build a habit, daily habit";
            case "calm" -> "stay calm, calm down";
            default -> "";
        };
        String commonMistake = switch (eng) {
            case "focus" -> "Use focus on, not focus in.";
            case "progress" -> "Say make progress, not do progress.";
            case "evidence" -> "Evidence is usually uncountable.";
            case "curious" -> "Say curious about something.";
            default -> "Check the example before using this word in writing.";
        };
        return new WordRequest(null, null, eng, vie, pos, tag, ipa, level, tag, example, "", collocation, "", "", commonMistake, "", false, false, null);
    }

    private String defaultText(String value, String fallback) {
        String clean = trim(value);
        return clean.isBlank() ? fallback : clean;
    }

    private String normalizeQuestionMode(String value) {
        String mode = defaultText(value, "eng").toLowerCase(Locale.ROOT);
        return "vie".equals(mode) ? "vie" : "eng";
    }

    private String promptFor(VocabularyWord word, String questionMode) {
        return "vie".equals(questionMode) ? word.getVie() : word.getEng();
    }

    private String correctAnswerFor(VocabularyWord word, String questionMode) {
        return "vie".equals(questionMode) ? word.getEng() : word.getVie();
    }

    private boolean answersMatch(String selectedAnswer, String correctAnswer) {
        return normalizeAnswerForComparison(selectedAnswer).equals(normalizeAnswerForComparison(correctAnswer));
    }

    private String normalizeAnswerForComparison(String value) {
        return trim(value).replaceAll("\\s+", " ");
    }

    private double scoreFor(int correctAnswers, int totalQuestions) {
        if (totalQuestions <= 0) return 0;
        return Math.round((correctAnswers * 10.0 / totalQuestions) * 100.0) / 100.0;
    }

    private int quizXp(int correctAnswers, int totalQuestions, int maxCombo) {
        return Math.max(0, correctAnswers * 12 + totalQuestions * 3 + maxCombo);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
