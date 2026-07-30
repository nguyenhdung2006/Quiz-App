package com.quizapp.vocab;

import com.quizapp.health.HealthCounterService;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.user.ProfileDto;
import com.quizapp.user.ProfileRequest;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncService {
    public static final int SYNC_CONTRACT_VERSION = 2;
    private static final Logger log = LoggerFactory.getLogger(SyncService.class);

    private final VocabularyRepository words;
    private final WrongBankRepository wrongBank;
    private final QuizHistoryRepository quizHistory;
    private final AchievementService achievements;
    private final LearningProgressService progress;
    private final AppUserRepository users;
    private final WordTombstoneRepository tombstones;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    public SyncService(
            VocabularyRepository words,
            WrongBankRepository wrongBank,
            QuizHistoryRepository quizHistory,
            AchievementService achievements,
            LearningProgressService progress,
            AppUserRepository users,
            WordTombstoneRepository tombstones
    ) {
        this.words = words;
        this.wrongBank = wrongBank;
        this.quizHistory = quizHistory;
        this.achievements = achievements;
        this.progress = progress;
        this.users = users;
        this.tombstones = tombstones;
    }

    @Transactional(readOnly = true)
    public SyncResponse snapshot(AppUser user) {
        log.info("[SNAPSHOT] Pull start userId={}", user.getId());
        try {
            SyncResponse result = buildSnapshot(user);
            log.info("[SNAPSHOT] Pull success userId={} revision={} vocabCount={} tombstoneCount={}",
                    user.getId(), result.revision(), result.vocab().size(), result.tombstones().size());
            return result;
        } catch (RuntimeException ex) {
            log.error("[SNAPSHOT] Pull failed userId={} type={} message={}",
                    user.getId(), ex.getClass().getSimpleName(), ex.getMessage());
            if (healthCounters != null) healthCounters.incrementSnapshotFailures();
            throw ex;
        }
    }

    @Transactional
    public SyncResponse sync(AppUser user, SyncRequest request) {
        AppUser syncUser = lockUserForRevision(user);
        requireSyncContractVersion(request);
        log.info("[SYNC] Push start userId={} expectedRevision={}", syncUser.getId(), request.expectedRevision());
        ensureExpectedRevision(syncUser, request.expectedRevision());

        Map<UUID, WordRequest> incomingWords = dedupeWordsByUid(request.vocab());
        Map<UUID, WordDeletionRequest> incomingDeletions = dedupeDeletionsByUid(request.deletions());
        incomingDeletions.keySet().forEach(incomingWords::remove);

        List<VocabularyWord> liveWords = words.findByUserOrderByCreatedAtDesc(syncUser);
        Map<UUID, VocabularyWord> liveByUid = liveWords.stream()
                .collect(Collectors.toMap(VocabularyWord::getWordUid, Function.identity(), (left, right) -> left));
        Set<UUID> existingTombstoneUids = tombstones.findByUserOrderByDeletedRevisionAscDeletedAtAsc(syncUser).stream()
                .map(WordTombstone::getWordUid)
                .collect(Collectors.toSet());

        boolean stateChanged = profileChanges(syncUser, request.profile())
                || liveByUid.keySet().stream().anyMatch(existingTombstoneUids::contains)
                || deletionsChangeState(incomingDeletions.keySet(), liveByUid, existingTombstoneUids)
                || wordsChangeState(syncUser, incomingWords.values(), liveByUid, existingTombstoneUids);

        long resultingRevision = syncUser.getSyncRevision();
        if (stateChanged) {
            resultingRevision = syncUser.incrementSyncRevision();
        }

        applyProfile(syncUser, request.profile());
        deleteLiveWordsCoveredByTombstones(syncUser, liveByUid, existingTombstoneUids);
        applyDeletions(syncUser, incomingDeletions.keySet(), liveByUid, existingTombstoneUids, resultingRevision);
        applyWords(syncUser, incomingWords.values(), existingTombstoneUids);

        SyncResponse result = buildSnapshot(syncUser);
        log.info("[SYNC] Push success userId={} revision={} changed={}",
                syncUser.getId(), result.revision(), stateChanged);
        return result;
    }

    @Transactional
    public void deleteWord(AppUser user, Long id) {
        AppUser syncUser = lockUserForRevision(user);
        words.findByIdAndUser(id, syncUser).ifPresent(word -> hardDeleteWithTombstone(syncUser, word));
    }

    @Transactional
    public void deleteWordByUid(AppUser user, UUID wordUid) {
        AppUser syncUser = lockUserForRevision(user);
        if (wordUid == null) return;
        words.findByUserAndWordUid(syncUser, wordUid)
                .ifPresentOrElse(
                        word -> hardDeleteWithTombstone(syncUser, word),
                        () -> {
                            if (!tombstones.existsByUserAndWordUid(syncUser, wordUid)) {
                                createTombstoneIfMissing(syncUser, wordUid, syncUser.incrementSyncRevision());
                            }
                        }
                );
    }

    private SyncResponse buildSnapshot(AppUser user) {
        List<UserAchievement> unlocked = achievements.listUnlocked(user);
        List<QuizHistoryDto> recentHistory = quizHistory.findTop10ByUserOrderByCreatedAtDesc(user).stream()
                .map(QuizHistoryDto::from)
                .toList();
        List<WordTombstone> userTombstones = tombstones.findByUserOrderByDeletedRevisionAscDeletedAtAsc(user);
        Set<UUID> deletedUids = userTombstones.stream()
                .map(WordTombstone::getWordUid)
                .collect(Collectors.toSet());
        return new SyncResponse(
                SYNC_CONTRACT_VERSION,
                user.getSyncRevision(),
                ProfileDto.from(user),
                words.findByUserOrderByCreatedAtDesc(user).stream()
                        .filter(word -> !deletedUids.contains(word.getWordUid()))
                        .map(WordDto::from)
                        .toList(),
                userTombstones.stream()
                        .map(WordTombstoneDto::from)
                        .toList(),
                wrongBank.findByUserOrderByCreatedAtDesc(user).stream()
                        .filter(entry -> !deletedUids.contains(entry.getWord().getWordUid()))
                        .map(entry -> WordDto.from(entry.getWord()))
                        .toList(),
                progress.progress(user, unlocked.size()),
                unlocked.stream().map(AchievementDto::from).toList(),
                recentHistory
        );
    }

    private void requireSyncContractVersion(SyncRequest request) {
        if (request == null || request.syncContractVersion() == null
                || request.syncContractVersion() != SYNC_CONTRACT_VERSION) {
            throw new SyncClientUpgradeRequiredException();
        }
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
            log.warn("[SYNC] Revision conflict userId={} expected={} actual={}",
                    user.getId(), expectedRevision, currentRevision);
            throw new SyncRevisionConflictException(expectedRevision, currentRevision);
        }
    }

    private Map<UUID, WordRequest> dedupeWordsByUid(List<WordRequest> incomingWords) {
        Map<UUID, WordRequest> result = new LinkedHashMap<>();
        if (incomingWords == null) return result;
        for (WordRequest incoming : incomingWords) {
            if (incoming == null) continue;
            if (incoming.wordUid() == null) {
                throw new IllegalArgumentException("wordUid is required for sync vocabulary items.");
            }
            ensureUsableSyncWord(incoming);
            result.put(incoming.wordUid(), incoming);
        }
        return result;
    }

    private Map<UUID, WordDeletionRequest> dedupeDeletionsByUid(List<WordDeletionRequest> incomingDeletions) {
        Map<UUID, WordDeletionRequest> result = new LinkedHashMap<>();
        if (incomingDeletions == null) return result;
        for (WordDeletionRequest incoming : incomingDeletions) {
            if (incoming == null || incoming.wordUid() == null) {
                throw new IllegalArgumentException("wordUid is required for sync deletions.");
            }
            result.put(incoming.wordUid(), incoming);
        }
        return result;
    }

    private boolean deletionsChangeState(
            Collection<UUID> deletionUids,
            Map<UUID, VocabularyWord> liveByUid,
            Set<UUID> tombstoneUids
    ) {
        return deletionUids.stream().anyMatch(wordUid ->
                !tombstoneUids.contains(wordUid) || liveByUid.containsKey(wordUid));
    }

    private boolean wordsChangeState(
            AppUser user,
            Collection<WordRequest> incomingWords,
            Map<UUID, VocabularyWord> liveByUid,
            Set<UUID> tombstoneUids
    ) {
        for (WordRequest incoming : incomingWords) {
            if (tombstoneUids.contains(incoming.wordUid())) continue;
            VocabularyWord current = liveByUid.get(incoming.wordUid());
            if (current == null) return true;
            if (wordDiffers(current, incoming)) return true;
            ensureNoDuplicateEnglish(user, normalizeEnglishForStorage(incoming.eng()), current.getId());
        }
        return false;
    }

    private void applyDeletions(
            AppUser user,
            Collection<UUID> deletionUids,
            Map<UUID, VocabularyWord> liveByUid,
            Set<UUID> tombstoneUids,
            long deletedRevision
    ) {
        Instant deletedAt = Instant.now();
        for (UUID wordUid : deletionUids) {
            VocabularyWord live = liveByUid.get(wordUid);
            if (live != null) {
                wrongBank.deleteByUserAndWord(user, live);
                words.delete(live);
            }
            if (!tombstoneUids.contains(wordUid)) {
                WordTombstone tombstone = new WordTombstone();
                tombstone.setUser(user);
                tombstone.setWordUid(wordUid);
                tombstone.setDeletedAt(deletedAt);
                tombstone.setDeletedRevision(deletedRevision);
                tombstones.save(tombstone);
                tombstoneUids.add(wordUid);
            }
        }
    }

    private void deleteLiveWordsCoveredByTombstones(
            AppUser user,
            Map<UUID, VocabularyWord> liveByUid,
            Set<UUID> tombstoneUids
    ) {
        for (UUID wordUid : tombstoneUids) {
            VocabularyWord live = liveByUid.get(wordUid);
            if (live == null) continue;
            wrongBank.deleteByUserAndWord(user, live);
            words.delete(live);
        }
    }

    private void applyWords(AppUser user, Collection<WordRequest> incomingWords, Set<UUID> tombstoneUids) {
        for (WordRequest incoming : incomingWords) {
            if (tombstoneUids.contains(incoming.wordUid())) continue;
            VocabularyWord word = words.findByUserAndWordUid(user, incoming.wordUid())
                    .orElseGet(() -> {
                        VocabularyWord created = new VocabularyWord();
                        created.setUser(user);
                        created.setWordUid(incoming.wordUid());
                        return created;
                    });
            ensureNoDuplicateEnglish(user, normalizeEnglishForStorage(incoming.eng()), word.getId());
            applyWordRequest(word, incoming);
            words.save(word);
        }
    }

    private void hardDeleteWithTombstone(AppUser user, VocabularyWord word) {
        long revision = user.incrementSyncRevision();
        wrongBank.deleteByUserAndWord(user, word);
        words.delete(word);
        createTombstoneIfMissing(user, word.getWordUid(), revision);
        log.info("[SYNC] Word deleted userId={} wordId={} wordUid={}",
                user.getId(), word.getId(), word.getWordUid());
    }

    private void createTombstoneIfMissing(AppUser user, UUID wordUid, long deletedRevision) {
        if (tombstones.existsByUserAndWordUid(user, wordUid)) return;
        WordTombstone tombstone = new WordTombstone();
        tombstone.setUser(user);
        tombstone.setWordUid(wordUid);
        tombstone.setDeletedAt(Instant.now());
        tombstone.setDeletedRevision(deletedRevision);
        tombstones.save(tombstone);
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

    private void ensureUsableSyncWord(WordRequest request) {
        String eng = normalizeEnglishForStorage(request.eng());
        String vie = trim(request.vie());
        if (eng.isBlank() || vie.isBlank()) {
            throw new IllegalArgumentException("English and Vietnamese are required.");
        }
        if (eng.length() > 255 || vie.length() > 255
                || !within(request.pos(), 50)
                || !within(request.tag(), 100)
                || !within(request.ipa(), 120)
                || !within(request.level(), 40)
                || !within(request.context(), 2_000)
                || !within(request.example(), 2_000)
                || !within(request.exampleMeaning(), 2_000)
                || !within(request.collocation(), 2_000)
                || !within(request.synonyms(), 2_000)
                || !within(request.antonyms(), 2_000)
                || !within(request.commonMistake(), 2_000)
                || !within(request.note(), 2_000)) {
            throw new IllegalArgumentException("Sync vocabulary item is invalid.");
        }
    }

    private boolean wordDiffers(VocabularyWord current, WordRequest incoming) {
        return !Objects.equals(current.getWordUid(), incoming.wordUid())
                || !Objects.equals(current.getEng(), normalizeEnglishForStorage(incoming.eng()))
                || !Objects.equals(current.getVie(), trim(incoming.vie()))
                || !Objects.equals(current.getPos(), defaultText(incoming.pos(), "n"))
                || !Objects.equals(blankToEmpty(current.getTag()), trim(incoming.tag()))
                || !Objects.equals(blankToEmpty(current.getIpa()), trim(incoming.ipa()))
                || !Objects.equals(current.getLevel(), defaultText(incoming.level(), "A1"))
                || !Objects.equals(blankToEmpty(current.getContext()), trim(incoming.context()))
                || !Objects.equals(blankToEmpty(current.getExample()), trim(incoming.example()))
                || !Objects.equals(blankToEmpty(current.getExampleMeaning()), trim(incoming.exampleMeaning()))
                || !Objects.equals(blankToEmpty(current.getCollocation()), trim(incoming.collocation()))
                || !Objects.equals(blankToEmpty(current.getSynonyms()), trim(incoming.synonyms()))
                || !Objects.equals(blankToEmpty(current.getAntonyms()), trim(incoming.antonyms()))
                || !Objects.equals(blankToEmpty(current.getCommonMistake()), trim(incoming.commonMistake()))
                || !Objects.equals(blankToEmpty(current.getNote()), trim(incoming.note()))
                || current.isFavorite() != incoming.favorite();
    }

    private boolean profileChanges(AppUser user, ProfileRequest profile) {
        if (profile == null) return false;
        boolean nameChanged = !trim(profile.name()).isBlank()
                && !Objects.equals(blankToEmpty(user.getDisplayName()), trim(profile.name()));
        boolean avatarChanged = !trim(profile.avatar()).isBlank()
                && !Objects.equals(blankToEmpty(user.getAvatarUrl()), trim(profile.avatar()));
        return nameChanged
                || avatarChanged
                || !Objects.equals(user.getBirthday(), profile.birthday())
                || !Objects.equals(blankToEmpty(user.getGender()), trim(profile.gender()))
                || !Objects.equals(blankToEmpty(user.getLearningGoal()), trim(profile.goal()))
                || !Objects.equals(blankToEmpty(user.getBio()), trim(profile.bio()));
    }

    private void applyProfile(AppUser user, ProfileRequest profile) {
        if (profile == null) return;
        String name = profileName(profile);
        if (!name.isBlank()) user.setDisplayName(name);
        String avatar = profileAvatar(profile);
        if (!avatar.isBlank()) user.setAvatarUrl(avatar);
        user.setBirthday(profile.birthday());
        user.setGender(trim(profile.gender()));
        user.setLearningGoal(trim(profile.goal()));
        user.setBio(trim(profile.bio()));
    }

    private String profileName(ProfileRequest profile) {
        return trim(profile.name()).isBlank() ? blankToEmpty(null) : trim(profile.name());
    }

    private String profileAvatar(ProfileRequest profile) {
        return trim(profile.avatar()).isBlank() ? blankToEmpty(null) : trim(profile.avatar());
    }

    private void ensureNoDuplicateEnglish(AppUser user, String normalizedEng, Long currentWordId) {
        if (normalizedEng.isBlank()) return;
        String normalizedKey = englishLookupKey(normalizedEng);
        words.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(word -> englishLookupKey(word.getEng()).equals(normalizedKey))
                .filter(existing -> currentWordId == null || !existing.getId().equals(currentWordId))
                .findFirst()
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Word already exists.");
                });
    }

    private boolean within(String value, int maxLength) {
        return value == null || value.length() <= maxLength;
    }

    private WordStats ensureStats(VocabularyWord word) {
        WordStats stats = word.getStats();
        if (stats == null) {
            stats = new WordStats();
            word.setStats(stats);
        }
        return stats;
    }

    private String normalizeEnglishForStorage(String value) {
        return trim(value).replaceAll("\\s+", " ");
    }

    private String englishLookupKey(String value) {
        return normalizeEnglishForStorage(value).toLowerCase(Locale.ROOT);
    }

    private String defaultText(String value, String fallback) {
        String clean = trim(value);
        return clean.isBlank() ? fallback : clean;
    }

    private String blankToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
