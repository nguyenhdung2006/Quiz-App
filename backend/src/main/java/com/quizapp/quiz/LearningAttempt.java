package com.quizapp.quiz;

import com.quizapp.user.AppUser;
import com.quizapp.vocab.QuizHistory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "learning_attempt",
        uniqueConstraints = @UniqueConstraint(
                name = "ux_learning_attempt_id_user",
                columnNames = {"id", "user_id"}
        )
)
public class LearningAttempt {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(name = "attempt_type", nullable = false, length = 20)
    private String attemptType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LearningAttemptStatus status;

    @Column(name = "quiz_mode", nullable = false, length = 50)
    private String quizMode;

    @Column(name = "challenge_seconds")
    private Integer challengeSeconds;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "submission_fingerprint", length = 64)
    private String submissionFingerprint;

    @Column(name = "resulting_sync_revision")
    private Long resultingSyncRevision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_history_id")
    private QuizHistory quizHistory;

    @Column(name = "awarded_quiz_xp")
    private Integer awardedQuizXp;

    @Column(name = "result_total_questions")
    private Integer resultTotalQuestions;

    @Column(name = "result_correct_answers")
    private Integer resultCorrectAnswers;

    @Column(name = "result_wrong_answers")
    private Integer resultWrongAnswers;

    @Column(name = "result_score")
    private Double resultScore;

    @Column(name = "result_max_combo")
    private Integer resultMaxCombo;

    protected LearningAttempt() {
    }

    static LearningAttempt issue(
            UUID id,
            AppUser user,
            String quizMode,
            Integer challengeSeconds,
            Instant createdAt,
            Instant expiresAt
    ) {
        if (id == null || user == null || user.getId() == null) {
            throw new IllegalArgumentException("Quiz attempt owner and id are required.");
        }
        if (quizMode == null || quizMode.isBlank()) {
            throw new IllegalArgumentException("Quiz mode is required.");
        }
        if (challengeSeconds != null && (challengeSeconds < 0 || challengeSeconds > 86_400)) {
            throw new IllegalArgumentException("Quiz challenge duration is invalid.");
        }
        if (createdAt == null || expiresAt == null || !expiresAt.isAfter(createdAt)) {
            throw new IllegalArgumentException("Quiz attempt expiry must follow issuance.");
        }

        LearningAttempt attempt = new LearningAttempt();
        attempt.id = id;
        attempt.user = user;
        attempt.attemptType = "QUIZ";
        attempt.status = LearningAttemptStatus.ISSUED;
        attempt.quizMode = quizMode;
        attempt.challengeSeconds = challengeSeconds;
        attempt.createdAt = createdAt;
        attempt.expiresAt = expiresAt;
        return attempt;
    }

    void consume(
            Instant consumedAt,
            String submissionFingerprint,
            long resultingSyncRevision,
            QuizHistory quizHistory,
            int awardedQuizXp,
            int totalQuestions,
            int correctAnswers,
            int wrongAnswers,
            double score,
            int maxCombo
    ) {
        if (status != LearningAttemptStatus.ISSUED) {
            throw new IllegalStateException("Only an issued quiz attempt can be consumed.");
        }
        if (consumedAt == null
                || consumedAt.isBefore(createdAt)
                || !consumedAt.isBefore(expiresAt)) {
            throw new IllegalArgumentException("Quiz attempt consumption time is invalid.");
        }
        if (submissionFingerprint == null
                || !submissionFingerprint.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("Quiz attempt fingerprint is invalid.");
        }
        if (quizHistory == null
                || resultingSyncRevision < 0
                || awardedQuizXp < 0
                || totalQuestions <= 0
                || correctAnswers < 0
                || wrongAnswers < 0
                || correctAnswers + wrongAnswers != totalQuestions
                || !Double.isFinite(score)
                || score < 0
                || score > 10
                || maxCombo < 0
                || maxCombo > totalQuestions) {
            throw new IllegalArgumentException("Quiz attempt outcome is invalid.");
        }

        this.status = LearningAttemptStatus.CONSUMED;
        this.consumedAt = consumedAt;
        this.submissionFingerprint = submissionFingerprint;
        this.resultingSyncRevision = resultingSyncRevision;
        this.quizHistory = quizHistory;
        this.awardedQuizXp = awardedQuizXp;
        this.resultTotalQuestions = totalQuestions;
        this.resultCorrectAnswers = correctAnswers;
        this.resultWrongAnswers = wrongAnswers;
        this.resultScore = score;
        this.resultMaxCombo = maxCombo;
    }

    public UUID getId() { return id; }
    public AppUser getUser() { return user; }
    public String getAttemptType() { return attemptType; }
    public LearningAttemptStatus getStatus() { return status; }
    public String getQuizMode() { return quizMode; }
    public Integer getChallengeSeconds() { return challengeSeconds; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getConsumedAt() { return consumedAt; }
    public String getSubmissionFingerprint() { return submissionFingerprint; }
    public Long getResultingSyncRevision() { return resultingSyncRevision; }
    public QuizHistory getQuizHistory() { return quizHistory; }
    public Integer getAwardedQuizXp() { return awardedQuizXp; }
    public Integer getResultTotalQuestions() { return resultTotalQuestions; }
    public Integer getResultCorrectAnswers() { return resultCorrectAnswers; }
    public Integer getResultWrongAnswers() { return resultWrongAnswers; }
    public Double getResultScore() { return resultScore; }
    public Integer getResultMaxCombo() { return resultMaxCombo; }
}
