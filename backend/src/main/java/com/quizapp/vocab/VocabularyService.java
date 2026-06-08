package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.user.ProfileDto;
import com.quizapp.user.ProfileRequest;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {
    private final VocabularyRepository words;
    private final WrongBankRepository wrongBank;
    private final QuizHistoryRepository quizHistory;
    private final AchievementService achievements;
    private final LearningProgressService progress;
    private final AppUserRepository users;

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
            AppUserRepository users
    ) {
        this.words = words;
        this.wrongBank = wrongBank;
        this.quizHistory = quizHistory;
        this.achievements = achievements;
        this.progress = progress;
        this.users = users;
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

    @Transactional
    public WordDto createWord(AppUser user, WordRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        String normalizedEng = normalizeEnglishForStorage(request.eng());
        ensureNoDuplicateEnglish(syncUser, normalizedEng, null);

        VocabularyWord word = new VocabularyWord();
        word.setUser(syncUser);
        applyWordRequest(word, request);
        WordDto created = WordDto.from(words.save(word));
        if (words.findByUserOrderByCreatedAtDesc(syncUser).size() == 1) {
            achievements.unlock(syncUser, "FIRST_WORD");
        }
        markCloudChanged(syncUser);
        return created;
    }

    @Transactional
    public WordDto updateWord(AppUser user, Long id, WordRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        VocabularyWord word = words.findByIdAndUser(id, syncUser)
                .orElseThrow(() -> new IllegalArgumentException("Word not found."));
        String normalizedEng = normalizeEnglishForStorage(request.eng());
        ensureNoDuplicateEnglish(syncUser, normalizedEng, id);

        applyWordRequest(word, request);
        WordDto updated = WordDto.from(words.save(word));
        markCloudChanged(syncUser);
        return updated;
    }

    @Transactional
    public void deleteWord(AppUser user, Long id) {
        AppUser syncUser = lockUserForRevision(user);
        words.findByIdAndUser(id, syncUser).ifPresent(word -> {
            words.delete(word);
            markCloudChanged(syncUser);
        });
    }

    @Transactional
    public SyncResponse importStarterWords(AppUser user) {
        AppUser syncUser = lockUserForRevision(user);
        for (WordRequest word : STARTER_WORDS) {
            upsertByEnglish(syncUser, word);
        }
        achievements.unlock(syncUser, "FIRST_WORD");
        markCloudChanged(syncUser);
        return snapshot(syncUser);
    }

    @Transactional
    public SyncResponse sync(AppUser user, SyncRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        ensureExpectedRevision(syncUser, request.expectedRevision());

        applyProfile(syncUser, request.profile());

        if (request.vocab() != null) {
            for (WordRequest incoming : request.vocab()) {
                if (!isUsableSyncWord(incoming)) continue;
                upsertByEnglish(syncUser, incoming);
            }
        }

        if (request.wrongWords() != null) {
            for (WordRequest incoming : request.wrongWords()) {
                if (!isUsableSyncWord(incoming)) continue;
                VocabularyWord word = upsertByEnglish(syncUser, incoming);
                wrongBank.findByUserAndWord(syncUser, word).orElseGet(() -> {
                    WrongBankEntry entry = new WrongBankEntry();
                    entry.setUser(syncUser);
                    entry.setWord(word);
                    return wrongBank.save(entry);
                }).setMastered(incoming.mastered());
            }
        }

        markCloudChanged(syncUser);
        return snapshot(syncUser);
    }

    @Transactional
    public SyncResponse recordQuizResult(AppUser user, QuizResultRequest request) {
        if (request.answers() == null) return snapshot(user);
        AppUser syncUser = lockUserForRevision(user);

        QuizHistory history = new QuizHistory();
        history.setUser(syncUser);
        history.setQuizMode(defaultText(request.quizMode(), "mixed"));
        history.setChallengeSeconds(request.challengeSeconds());
        history.setTotalQuestions(Math.max(0, request.totalQuestions()));
        history.setCorrectAnswers(Math.max(0, request.correctAnswers()));
        history.setWrongAnswers(Math.max(0, request.wrongAnswers()));
        history.setScore(Math.max(0, Math.min(10, request.score())));
        history.setMaxCombo(Math.max(0, request.maxCombo()));

        for (QuizAnswerRequest answer : request.answers()) {
            if (answer.eng() == null || answer.eng().isBlank()) continue;

            words.findByUserAndEngIgnoreCase(syncUser, answer.eng()).ifPresent(word -> {
                WordStats stats = ensureStats(word);
                stats.setSeen(stats.getSeen() + 1);
                stats.setLastReviewed(Instant.now());

                if (answer.correct()) {
                    stats.setCorrect(stats.getCorrect() + 1);
                    stats.setCurrentStreak(stats.getCurrentStreak() + 1);
                    stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
                    stats.setMasteryLevel(Math.min(5, stats.getMasteryLevel() + 1));
                    wrongBank.findByUserAndWord(syncUser, word).ifPresent(entry -> entry.setMastered(true));
                } else {
                    stats.setWrong(stats.getWrong() + 1);
                    stats.setCurrentStreak(0);
                    stats.setMasteryLevel(Math.max(0, stats.getMasteryLevel() - 1));
                    word.setMastered(false);
                    WrongBankEntry entry = wrongBank.findByUserAndWord(syncUser, word).orElseGet(() -> {
                        WrongBankEntry next = new WrongBankEntry();
                        next.setUser(syncUser);
                        next.setWord(word);
                        return next;
                    });
                    entry.setMastered(false);
                    wrongBank.save(entry);
                }

                if (stats.getCurrentStreak() >= 5) {
                    word.setMastered(true);
                    stats.setMasteryLevel(5);
                }

                stats.setNextReview(progress.nextReview(stats, answer.correct()));

                QuizHistoryAnswer savedAnswer = new QuizHistoryAnswer();
                savedAnswer.setWord(word);
                savedAnswer.setQuestionMode(defaultText(answer.questionMode(), "mixed"));
                savedAnswer.setPrompt(word.getEng());
                savedAnswer.setSelectedAnswer(trim(answer.selectedAnswer()));
                savedAnswer.setCorrectAnswer(trim(answer.correctAnswer()));
                savedAnswer.setCorrect(answer.correct());
                history.addAnswer(savedAnswer);
            });
        }

        quizHistory.save(history);

        int earnedXp = Math.max(0, request.correctAnswers() * 12 + request.totalQuestions() * 3 + request.maxCombo());
        syncUser.setXp(syncUser.getXp() + earnedXp);
        syncUser.setLevel(Math.max(1, syncUser.getXp() / 250 + 1));
        syncUser.setBestStreak(Math.max(syncUser.getBestStreak(), request.maxCombo()));

        achievements.unlock(syncUser, "FIRST_QUIZ");
        if (request.totalQuestions() > 0 && request.correctAnswers() == request.totalQuestions()) {
            achievements.unlock(syncUser, "PERFECT_ROUND");
        }
        if (request.maxCombo() >= 10) {
            achievements.unlock(syncUser, "COMBO_10");
        }
        if ("daily".equalsIgnoreCase(defaultText(request.quizMode(), ""))) {
            achievements.unlock(syncUser, "DAILY_CHALLENGE");
        }

        markCloudChanged(syncUser);
        return snapshot(syncUser);
    }

    @Transactional(readOnly = true)
    public SyncResponse snapshot(AppUser user) {
        List<UserAchievement> unlocked = achievements.listUnlocked(user);
        List<QuizHistoryDto> recentHistory = quizHistory.findTop10ByUserOrderByCreatedAtDesc(user).stream()
                .map(QuizHistoryDto::from)
                .toList();
        return new SyncResponse(
                user.getSyncRevision(),
                ProfileDto.from(user),
                listWords(user),
                listWrongWords(user),
                progress.progress(user, unlocked.size()),
                unlocked.stream().map(AchievementDto::from).toList(),
                recentHistory
        );
    }

    private AppUser lockUserForRevision(AppUser user) {
        if (user == null || user.getId() == null) {
            throw new IllegalStateException("Authentication is required.");
        }
        return users.findByIdForSyncUpdate(user.getId())
                .orElseThrow(() -> new IllegalStateException("User not found."));
    }

    private void ensureExpectedRevision(AppUser user, Long expectedRevision) {
        long currentRevision = user.getSyncRevision();
        if (expectedRevision == null || expectedRevision.longValue() != currentRevision) {
            throw new SyncRevisionConflictException(expectedRevision, currentRevision);
        }
    }

    private void markCloudChanged(AppUser user) {
        user.incrementSyncRevision();
    }

    private boolean isUsableSyncWord(WordRequest request) {
        if (request == null) return false;
        String eng = normalizeEnglishForStorage(request.eng());
        String vie = trim(request.vie());
        return !eng.isBlank()
                && !vie.isBlank()
                && eng.length() <= 255
                && vie.length() <= 255
                && within(request.pos(), 50)
                && within(request.tag(), 100)
                && within(request.ipa(), 120)
                && within(request.level(), 40)
                && within(request.context(), 2_000)
                && within(request.example(), 2_000)
                && within(request.exampleMeaning(), 2_000)
                && within(request.collocation(), 2_000)
                && within(request.synonyms(), 2_000)
                && within(request.antonyms(), 2_000)
                && within(request.commonMistake(), 2_000)
                && within(request.note(), 2_000);
    }

    private boolean within(String value, int maxLength) {
        return value == null || value.length() <= maxLength;
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
        word.setMastered(request.mastered());

        WordStats stats = ensureStats(word);
        if (request.stats() != null) {
            stats.setSeen(request.stats().seen());
            stats.setCorrect(request.stats().correct());
            stats.setWrong(request.stats().wrong());
            stats.setCurrentStreak(request.stats().streak());
            stats.setBestStreak(request.stats().bestStreak());
            stats.setMasteryLevel(request.stats().masteryLevel());
            stats.setLastReviewed(request.stats().lastReviewed());
            stats.setNextReview(request.stats().nextReview());
        }
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
        return new WordRequest(null, eng, vie, pos, tag, ipa, level, tag, example, "", collocation, "", "", commonMistake, "", false, false, null);
    }

    private void applyProfile(AppUser user, ProfileRequest profile) {
        if (profile == null) return;
        if (!trim(profile.name()).isBlank()) user.setDisplayName(trim(profile.name()));
        if (!trim(profile.avatar()).isBlank()) user.setAvatarUrl(trim(profile.avatar()));
        user.setBirthday(profile.birthday());
        user.setGender(trim(profile.gender()));
        user.setLearningGoal(trim(profile.goal()));
        user.setBio(trim(profile.bio()));
    }

    private String defaultText(String value, String fallback) {
        String clean = trim(value);
        return clean.isBlank() ? fallback : clean;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
