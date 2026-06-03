package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import com.quizapp.user.ProfileDto;
import com.quizapp.user.ProfileRequest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {
    private final VocabularyRepository words;
    private final WrongBankRepository wrongBank;
    private final QuizHistoryRepository quizHistory;
    private final AchievementRepository achievements;
    private final UserAchievementRepository userAchievements;

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
            AchievementRepository achievements,
            UserAchievementRepository userAchievements
    ) {
        this.words = words;
        this.wrongBank = wrongBank;
        this.quizHistory = quizHistory;
        this.achievements = achievements;
        this.userAchievements = userAchievements;
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
        VocabularyWord word = new VocabularyWord();
        word.setUser(user);
        applyWordRequest(word, request);
        WordDto created = WordDto.from(words.save(word));
        if (words.findByUserOrderByCreatedAtDesc(user).size() == 1) {
            unlock(user, "FIRST_WORD");
        }
        return created;
    }

    @Transactional
    public WordDto updateWord(AppUser user, Long id, WordRequest request) {
        VocabularyWord word = words.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Word not found."));
        applyWordRequest(word, request);
        return WordDto.from(words.save(word));
    }

    @Transactional
    public void deleteWord(AppUser user, Long id) {
        VocabularyWord word = words.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Word not found."));
        words.delete(word);
    }

    @Transactional
    public SyncResponse importStarterWords(AppUser user) {
        for (WordRequest word : STARTER_WORDS) {
            upsertByEnglish(user, word);
        }
        unlock(user, "FIRST_WORD");
        return snapshot(user);
    }

    @Transactional
    public SyncResponse sync(AppUser user, SyncRequest request) {
        applyProfile(user, request.profile());

        if (request.vocab() != null) {
            for (WordRequest incoming : request.vocab()) {
                upsertByEnglish(user, incoming);
            }
        }

        if (request.wrongWords() != null) {
            for (WordRequest incoming : request.wrongWords()) {
                VocabularyWord word = upsertByEnglish(user, incoming);
                wrongBank.findByUserAndWord(user, word).orElseGet(() -> {
                    WrongBankEntry entry = new WrongBankEntry();
                    entry.setUser(user);
                    entry.setWord(word);
                    return wrongBank.save(entry);
                }).setMastered(incoming.mastered());
            }
        }

        return snapshot(user);
    }

    @Transactional
    public SyncResponse recordQuizResult(AppUser user, QuizResultRequest request) {
        if (request.answers() == null) return snapshot(user);

        QuizHistory history = new QuizHistory();
        history.setUser(user);
        history.setQuizMode(defaultText(request.quizMode(), "mixed"));
        history.setChallengeSeconds(request.challengeSeconds());
        history.setTotalQuestions(Math.max(0, request.totalQuestions()));
        history.setCorrectAnswers(Math.max(0, request.correctAnswers()));
        history.setWrongAnswers(Math.max(0, request.wrongAnswers()));
        history.setScore(Math.max(0, Math.min(10, request.score())));
        history.setMaxCombo(Math.max(0, request.maxCombo()));

        for (QuizAnswerRequest answer : request.answers()) {
            if (answer.eng() == null || answer.eng().isBlank()) continue;

            words.findByUserAndEngIgnoreCase(user, answer.eng()).ifPresent(word -> {
                WordStats stats = ensureStats(word);
                stats.setSeen(stats.getSeen() + 1);
                stats.setLastReviewed(Instant.now());

                if (answer.correct()) {
                    stats.setCorrect(stats.getCorrect() + 1);
                    stats.setCurrentStreak(stats.getCurrentStreak() + 1);
                    stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
                    stats.setMasteryLevel(Math.min(5, stats.getMasteryLevel() + 1));
                    wrongBank.findByUserAndWord(user, word).ifPresent(entry -> entry.setMastered(true));
                } else {
                    stats.setWrong(stats.getWrong() + 1);
                    stats.setCurrentStreak(0);
                    stats.setMasteryLevel(Math.max(0, stats.getMasteryLevel() - 1));
                    word.setMastered(false);
                    WrongBankEntry entry = wrongBank.findByUserAndWord(user, word).orElseGet(() -> {
                        WrongBankEntry next = new WrongBankEntry();
                        next.setUser(user);
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

                stats.setNextReview(nextReview(stats, answer.correct()));

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
        user.setXp(user.getXp() + earnedXp);
        user.setLevel(Math.max(1, user.getXp() / 250 + 1));
        user.setBestStreak(Math.max(user.getBestStreak(), request.maxCombo()));

        unlock(user, "FIRST_QUIZ");
        if (request.totalQuestions() > 0 && request.correctAnswers() == request.totalQuestions()) {
            unlock(user, "PERFECT_ROUND");
        }
        if (request.maxCombo() >= 10) {
            unlock(user, "COMBO_10");
        }
        if ("daily".equalsIgnoreCase(defaultText(request.quizMode(), ""))) {
            unlock(user, "DAILY_CHALLENGE");
        }

        return snapshot(user);
    }

    @Transactional(readOnly = true)
    public SyncResponse snapshot(AppUser user) {
        List<UserAchievement> unlocked = userAchievements.findByUserOrderByUnlockedAtDesc(user);
        List<QuizHistoryDto> recentHistory = quizHistory.findTop10ByUserOrderByCreatedAtDesc(user).stream()
                .map(QuizHistoryDto::from)
                .toList();
        return new SyncResponse(
                ProfileDto.from(user),
                listWords(user),
                listWrongWords(user),
                progress(user, unlocked.size()),
                unlocked.stream().map(AchievementDto::from).toList(),
                recentHistory
        );
    }

    private VocabularyWord upsertByEnglish(AppUser user, WordRequest request) {
        VocabularyWord word = words.findByUserAndEngIgnoreCase(user, trim(request.eng()))
                .orElseGet(() -> {
                    VocabularyWord created = new VocabularyWord();
                    created.setUser(user);
                    return created;
                });
        applyWordRequest(word, request);
        return words.save(word);
    }

    private void applyWordRequest(VocabularyWord word, WordRequest request) {
        String eng = trim(request.eng());
        String vie = trim(request.vie());
        if (eng.isBlank() || vie.isBlank()) {
            throw new IllegalArgumentException("English and Vietnamese are required.");
        }

        word.setEng(eng);
        word.setVie(vie);
        word.setPos(defaultText(request.pos(), "n"));
        word.setTag(trim(request.tag()));
        word.setExample(trim(request.example()));
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

    private WordStats ensureStats(VocabularyWord word) {
        WordStats stats = word.getStats();
        if (stats == null) {
            stats = new WordStats();
            word.setStats(stats);
        }
        return stats;
    }

    private ProgressSummaryDto progress(AppUser user, int unlockedAchievementCount) {
        Instant weekStart = Instant.now().minus(Duration.ofDays(7));
        List<QuizHistory> weekly = quizHistory.findByUserAndCreatedAtAfterOrderByCreatedAtDesc(user, weekStart);
        int weeklyCorrect = weekly.stream().mapToInt(QuizHistory::getCorrectAnswers).sum();
        double weeklyAverage = weekly.isEmpty()
                ? 0
                : weekly.stream().mapToDouble(QuizHistory::getScore).average().orElse(0);
        long dueToday = words.findByUserOrderByCreatedAtDesc(user).stream()
                .map(VocabularyWord::getStats)
                .filter(stats -> stats != null && stats.getNextReview() != null)
                .filter(stats -> !stats.getNextReview().isAfter(Instant.now()))
                .count();

        return new ProgressSummaryDto(
                quizHistory.countByUser(user),
                weekly.size(),
                weeklyCorrect,
                Math.round(weeklyAverage * 100.0) / 100.0,
                dueToday,
                unlockedAchievementCount
        );
    }

    private void unlock(AppUser user, String code) {
        Achievement achievement = achievements.findByCode(code)
                .orElseGet(() -> achievements.save(defaultAchievement(code)));
        UserAchievementId id = new UserAchievementId(user.getId(), achievement.getId());
        if (userAchievements.existsById(id)) return;

        UserAchievement unlocked = new UserAchievement();
        unlocked.setId(id);
        unlocked.setUser(user);
        unlocked.setAchievement(achievement);
        userAchievements.save(unlocked);
        user.setXp(user.getXp() + achievement.getXpReward());
        user.setLevel(Math.max(1, user.getXp() / 250 + 1));
    }

    private Instant nextReview(WordStats stats, boolean correct) {
        int days;
        if (!correct) {
            days = 1;
        } else {
            days = switch (Math.min(stats.getCurrentStreak(), 5)) {
                case 0, 1 -> 1;
                case 2 -> 3;
                case 3 -> 7;
                case 4 -> 14;
                default -> 30;
            };
        }
        return Instant.now().plus(Duration.ofDays(days));
    }

    private static WordRequest starter(String eng, String vie, String pos, String tag) {
        return new WordRequest(null, eng, vie, pos, tag, "", "", false, false, null);
    }

    private Achievement defaultAchievement(String code) {
        Achievement achievement = new Achievement();
        achievement.setCode(code);
        switch (code) {
            case "FIRST_WORD" -> {
                achievement.setName("First Word");
                achievement.setDescription("Add your first vocabulary word.");
                achievement.setXpReward(10);
            }
            case "FIRST_QUIZ" -> {
                achievement.setName("First Quiz");
                achievement.setDescription("Complete your first quiz round.");
                achievement.setXpReward(20);
            }
            case "PERFECT_ROUND" -> {
                achievement.setName("Perfect Round");
                achievement.setDescription("Finish a quiz with every answer correct.");
                achievement.setXpReward(50);
            }
            case "COMBO_10" -> {
                achievement.setName("Combo 10");
                achievement.setDescription("Reach a 10-answer combo.");
                achievement.setXpReward(40);
            }
            case "DAILY_CHALLENGE" -> {
                achievement.setName("Daily Challenger");
                achievement.setDescription("Complete a daily challenge.");
                achievement.setXpReward(30);
            }
            default -> {
                achievement.setName(code);
                achievement.setDescription("Unlocked through learning activity.");
                achievement.setXpReward(0);
            }
        }
        return achievement;
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
