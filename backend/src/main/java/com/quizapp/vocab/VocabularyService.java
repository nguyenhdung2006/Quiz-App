package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import com.quizapp.user.ProfileDto;
import com.quizapp.user.ProfileRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {
    private final VocabularyRepository words;
    private final WrongBankRepository wrongBank;

    public VocabularyService(VocabularyRepository words, WrongBankRepository wrongBank) {
        this.words = words;
        this.wrongBank = wrongBank;
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
        return WordDto.from(words.save(word));
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
                    wrongBank.findByUserAndWord(user, word).ifPresent(entry -> entry.setMastered(true));
                } else {
                    stats.setWrong(stats.getWrong() + 1);
                    stats.setCurrentStreak(0);
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
            });
        }

        int xp = Math.max(user.getXp(), request.correctAnswers() * 12 + request.totalQuestions() * 3);
        user.setXp(user.getXp() + xp);
        user.setLevel(Math.max(1, user.getXp() / 250 + 1));
        user.setBestStreak(Math.max(user.getBestStreak(), request.maxCombo()));
        return snapshot(user);
    }

    @Transactional(readOnly = true)
    public SyncResponse snapshot(AppUser user) {
        return new SyncResponse(ProfileDto.from(user), listWords(user), listWrongWords(user));
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
