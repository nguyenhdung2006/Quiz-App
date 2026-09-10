package com.quizapp.review;

import com.quizapp.health.HealthCounterService;
import com.quizapp.retention.LearningRetentionCleanupTrigger;
import com.quizapp.shared.RevisionedResult;
import com.quizapp.user.AppUser;
import com.quizapp.user.AppUserRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordDto;
import com.quizapp.vocab.WordStats;
import com.quizapp.vocab.WrongBankEntry;
import com.quizapp.vocab.WrongBankRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.HexFormat;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.dao.DataIntegrityViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SpacedRepetitionService {
    private static final Logger log = LoggerFactory.getLogger(SpacedRepetitionService.class);
    private static final int MAX_SAFE_COUNT = 1_000_000;

    private final VocabularyRepository words;
    private final AppUserRepository users;
    private final WrongBankRepository wrongBank;
    private final ReviewOperationRepository operations;
    private final LearningRetentionCleanupTrigger retentionCleanup;

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    @Autowired
    public SpacedRepetitionService(
            VocabularyRepository words,
            AppUserRepository users,
            WrongBankRepository wrongBank,
            ReviewOperationRepository operations,
            LearningRetentionCleanupTrigger retentionCleanup
    ) {
        this.words = words;
        this.users = users;
        this.wrongBank = wrongBank;
        this.operations = operations;
        this.retentionCleanup = retentionCleanup;
    }

    public SpacedRepetitionService(VocabularyRepository words, AppUserRepository users) {
        this(words, users, null, null, null);
    }

    public SpacedRepetitionService(VocabularyRepository words) {
        this(words, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<ReviewQueueItemDto> today(AppUser user) {
        return queue(user, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<ReviewQueueItemDto> queue(AppUser user, Integer limit, String tag, String level) {
        Instant now = Instant.now();
        String normalizedTag = normalizeFilter(tag);
        String normalizedLevel = normalizeFilter(level);
        if (limit != null && limit > 0) {
            return words.findDueForReviewLimited(
                            user,
                            now,
                            now.minus(Duration.ofDays(1)),
                            now.minus(Duration.ofDays(2)),
                            now.minus(Duration.ofDays(3)),
                            now.minus(Duration.ofDays(4)),
                            now.minus(Duration.ofDays(5)),
                            now.minus(Duration.ofDays(6)),
                            normalizedTag,
                            normalizedLevel,
                            PageRequest.of(0, limit)
                    ).stream()
                    .map(word -> toQueueItem(word, now))
                    .toList();
        }
        return words.findDueForReview(user, now, normalizedTag, normalizedLevel).stream()
                .map(word -> toQueueItem(word, now))
                .sorted(Comparator.comparingInt(ReviewQueueItemDto::priority).reversed())
                .toList();
    }

    @Transactional
    public RevisionedResult<ReviewAnswerResponse> answer(AppUser user, ReviewAnswerRequest request) {
        String mode = normalizeFilter(request.mode());
        if (request.operationId() == null || request.correct() == null
                || !("review".equals(mode) || "mark-hard".equals(mode))
                || ("mark-hard".equals(mode) && request.correct())) {
            throw new IllegalArgumentException("Review requires an operation id and a supported action.");
        }
        return process(user, request.operationId(), request.wordId(), mode, request.correct());
    }

    @Transactional
    public RevisionedResult<ReviewAnswerResponse> markKnown(AppUser user, MarkKnownRequest request) {
        if (request.operationId() == null) throw new IllegalArgumentException("Operation id is required.");
        return process(user, request.operationId(), request.wordId(), "known", true);
    }

    private RevisionedResult<ReviewAnswerResponse> process(AppUser user, UUID operationId,
            Long wordId, String action, boolean correct) {
        // This database lock is held until commit/rollback, including ledger insertion.
        AppUser syncUser = lockUserForRevision(user);
        String fingerprint = fingerprint(wordId, action, correct);
        ReviewOperation existing = operations.findById(operationId).orElse(null);
        if (existing != null) {
            if (!syncUser.getId().equals(existing.getUserId())
                    || !fingerprint.equals(existing.getFingerprint())) {
                throw conflict();
            }
            VocabularyWord current = existing.getTargetWordId() == null ? null
                    : words.findByIdAndUser(existing.getTargetWordId(), syncUser).orElse(null);
            return response(syncUser, existing.outcome(), current, true);
        }

        VocabularyWord word = requireWord(syncUser, wordId);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if ("review".equals(action) && (word.getStats() == null
                || word.getStats().getNextReview() == null || word.getStats().getNextReview().isAfter(now))) {
            throw new ReviewOperationConflictException("REVIEW_NOT_DUE", "This review is no longer due. Refresh the queue.");
        }
        WordStats stats = "known".equals(action) ? applyKnown(word, now) : applyAnswer(word, correct, now);
        words.save(word);
        synchronizeWrongBank(syncUser, word, correct);
        long revision = syncUser.incrementSyncRevision();
        String resultMessage = "known".equals(action) ? "Known state saved." : message(stats, correct);
        ReviewOperationOutcome outcome = new ReviewOperationOutcome(operationId, wordId, action,
                masteryPercent(stats), stats.getCurrentStreak(), stats.getNextReview(), resultMessage, revision);
        try {
            operations.insert(operationId, syncUser.getId(), wordId, action, fingerprint, now,
                    outcome.mastery(), outcome.streak(), outcome.nextReview(), resultMessage, revision);
            retentionCleanup.afterLedgerWrite();
        } catch (DataIntegrityViolationException exception) {
            // Different owners do not share the user lock. A racing global UUID collision
            // fails closed and rolls back ALL word/wrong-bank/revision writes in this transaction.
            if (exception.getMostSpecificCause() instanceof java.sql.SQLException sql
                    && "23505".equals(sql.getSQLState())) throw conflict();
            throw exception;
        }
        return response(syncUser, outcome, word, false);
    }

    private WordStats applyKnown(VocabularyWord word, Instant reviewedAt) {
        WordStats stats = ensureStats(word);
        sanitizeStats(stats);
        stats.setSeen(increment(stats.getSeen()));
        stats.setCorrect(increment(stats.getCorrect()));
        stats.setCurrentStreak(Math.max(2, increment(stats.getCurrentStreak())));
        stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
        stats.setMasteryLevel(Math.max(3, Math.min(5, stats.getMasteryLevel() + 1)));
        stats.setLastReviewed(reviewedAt);
        word.setMastered(stats.getCurrentStreak() >= 5);
        stats.setNextReview(nextReview(stats, true, reviewedAt));
        return stats;
    }

    private RevisionedResult<ReviewAnswerResponse> response(AppUser user, ReviewOperationOutcome outcome,
            VocabularyWord word, boolean replayed) {
        long revision = user.getSyncRevision();
        boolean inWrongBank = word != null && wrongBank.findByUserAndWord(user, word).isPresent();
        return new RevisionedResult<>(new ReviewAnswerResponse(outcome, replayed,
                word == null ? null : WordDto.from(word), inWrongBank, revision), revision);
    }

    private String fingerprint(Long wordId, String action, boolean correct) {
        // Only validated fixed action names, a positive integer and a boolean; no JSON ordering.
        String canonical = "review-operation-v1|" + action + "|" + wordId + "|" + correct;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private ReviewOperationConflictException conflict() {
        return new ReviewOperationConflictException("REVIEW_OPERATION_CONFLICT", "Operation id is unavailable for this request.");
    }

    public WordStats applyAnswer(VocabularyWord word, boolean correct, Instant reviewedAt) {
        WordStats stats = ensureStats(word);
        Instant safeReviewedAt = safeReviewedAt(reviewedAt);
        sanitizeStats(stats);

        stats.setSeen(increment(stats.getSeen()));
        stats.setLastReviewed(safeReviewedAt);

        if (correct) {
            stats.setCorrect(increment(stats.getCorrect()));
            stats.setCurrentStreak(increment(stats.getCurrentStreak()));
            stats.setBestStreak(Math.max(stats.getBestStreak(), stats.getCurrentStreak()));
            stats.setMasteryLevel(Math.min(5, stats.getMasteryLevel() + 1));
        } else {
            stats.setWrong(increment(stats.getWrong()));
            stats.setCurrentStreak(0);
            stats.setMasteryLevel(Math.max(0, stats.getMasteryLevel() - 1));
            word.setMastered(false);
        }

        word.setMastered(stats.getCurrentStreak() >= 5);
        if (word.isMastered()) {
            stats.setMasteryLevel(5);
        }

        stats.setNextReview(nextReview(stats, correct, safeReviewedAt));
        return stats;
    }

    public Instant nextReview(WordStats stats, boolean correct, Instant reviewedAt) {
        Instant safeReviewedAt = safeReviewedAt(reviewedAt);
        if (!correct) {
            return safeReviewedAt.plus(Duration.ofDays(1));
        }

        int streak = stats == null ? 0 : safeCount(stats.getCurrentStreak());
        int days = switch (Math.min(streak, 5)) {
            case 0, 1 -> 1;
            case 2 -> 3;
            case 3 -> 7;
            case 4 -> 14;
            default -> 30;
        };
        return safeReviewedAt.plus(Duration.ofDays(days));
    }

    private ReviewQueueItemDto toQueueItem(VocabularyWord word, Instant now) {
        WordStats stats = ensureStats(word);
        return new ReviewQueueItemDto(
                word.getId(),
                word.getEng(),
                word.getVie(),
                blankFallback(word.getTag(), "untagged"),
                blankFallback(word.getLevel(), "unknown"),
                masteryPercent(stats),
                safeCount(stats.getCurrentStreak()),
                safeCount(stats.getWrong()),
                stats.getNextReview(),
                priority(word, now),
                reason(word, now)
        );
    }

    private int priority(VocabularyWord word, Instant now) {
        WordStats stats = ensureStats(word);
        long overdueDays = stats.getNextReview() == null
                ? 0
                : Math.max(0, ChronoUnit.DAYS.between(stats.getNextReview(), now));
        int lowMastery = 100 - masteryPercent(stats);
        int wrongPressure = Math.min(30, safeCount(stats.getWrong()) * 6);
        int overduePressure = (int) Math.min(30, overdueDays * 5);
        return Math.max(0, Math.min(100, lowMastery + wrongPressure + overduePressure));
    }

    private String reason(VocabularyWord word, Instant now) {
        WordStats stats = ensureStats(word);
        boolean overdue = stats.getNextReview() != null && stats.getNextReview().isBefore(now.minus(Duration.ofDays(1)));
        if (overdue && masteryPercent(stats) < 60) return "Overdue and low mastery";
        if (overdue) return "Overdue review";
        if (safeCount(stats.getWrong()) >= 3) return "High wrong count";
        if (masteryPercent(stats) < 60) return "Low mastery";
        return "Due today";
    }

    private int masteryPercent(WordStats stats) {
        return Math.max(0, Math.min(100, safeMastery(stats.getMasteryLevel()) * 20));
    }

    private WordStats ensureStats(VocabularyWord word) {
        WordStats stats = word.getStats();
        if (stats == null) {
            stats = new WordStats();
            word.setStats(stats);
        }
        return stats;
    }

    private VocabularyWord requireWord(AppUser user, Long wordId) {
        return words.findByIdAndUser(wordId, user)
                .orElseThrow(() -> {
                    log.warn("[REVIEW] Invalid review payload - word not found userId={} wordId={}",
                            user.getId(), wordId);
                    if (healthCounters != null) healthCounters.incrementReviewFailures();
                    return new IllegalArgumentException("Word not found.");
                });
    }

    private void synchronizeWrongBank(AppUser user, VocabularyWord word, boolean correct) {
        if (wrongBank == null) return;
        WrongBankEntry entry = wrongBank.findByUserAndWord(user, word).orElse(null);
        if (!correct && entry == null) {
            entry = new WrongBankEntry();
            entry.setUser(user);
            entry.setWord(word);
        }
        if (entry != null) {
            entry.setMastered(word.isMastered());
            wrongBank.save(entry);
        }
    }

    private String message(WordStats stats, boolean correct) {
        if (!correct) {
            return "Review this word again tomorrow.";
        }
        return switch (Math.min(safeCount(stats.getCurrentStreak()), 5)) {
            case 0, 1 -> "Good job. Review again in 1 day.";
            case 2 -> "Good job. Review again in 3 days.";
            case 3 -> "Good job. Review again in 7 days.";
            case 4 -> "Good job. Review again in 14 days.";
            default -> "Great work. Review again in 30 days.";
        };
    }

    private String normalizeFilter(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String blankFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private void sanitizeStats(WordStats stats) {
        stats.setSeen(safeCount(stats.getSeen()));
        stats.setCorrect(safeCount(stats.getCorrect()));
        stats.setWrong(safeCount(stats.getWrong()));
        stats.setCurrentStreak(safeCount(stats.getCurrentStreak()));
        stats.setBestStreak(Math.max(safeCount(stats.getBestStreak()), stats.getCurrentStreak()));
        stats.setMasteryLevel(safeMastery(stats.getMasteryLevel()));
    }

    private int increment(int value) {
        return Math.min(MAX_SAFE_COUNT, safeCount(value) + 1);
    }

    private int safeCount(int value) {
        return Math.max(0, Math.min(MAX_SAFE_COUNT, value));
    }

    private int safeMastery(int value) {
        return Math.max(0, Math.min(5, value));
    }

    private Instant safeReviewedAt(Instant reviewedAt) {
        return reviewedAt == null ? Instant.now() : reviewedAt;
    }

    private AppUser lockUserForRevision(AppUser user) {
        if (user == null || user.getId() == null) {
            throw new IllegalStateException("Authentication is required.");
        }
        return users.findByIdForSyncUpdate(user.getId())
                .orElseThrow(() -> new IllegalStateException("User not found."));
    }
}
