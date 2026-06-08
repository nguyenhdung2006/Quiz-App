package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "quiz_history")
public class QuizHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions = 0;

    @Column(name = "correct_answers", nullable = false)
    private Integer correctAnswers = 0;

    @Column(name = "wrong_answers", nullable = false)
    private Integer wrongAnswers = 0;

    private Double score = 0.0;

    @Column(name = "quiz_mode", nullable = false)
    private String quizMode;

    @Column(name = "challenge_seconds")
    private Integer challengeSeconds;

    @Column(name = "max_combo", nullable = false)
    private Integer maxCombo = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "quizHistory", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<QuizHistoryAnswer> answers = new ArrayList<>();

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }

    public void addAnswer(QuizHistoryAnswer answer) {
        answers.add(answer);
        answer.setQuizHistory(this);
    }

    public Long getId() { return id; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public int getTotalQuestions() { return totalQuestions == null ? 0 : totalQuestions; }
    public void setTotalQuestions(int totalQuestions) { this.totalQuestions = totalQuestions; }
    public int getCorrectAnswers() { return correctAnswers == null ? 0 : correctAnswers; }
    public void setCorrectAnswers(int correctAnswers) { this.correctAnswers = correctAnswers; }
    public int getWrongAnswers() { return wrongAnswers == null ? 0 : wrongAnswers; }
    public void setWrongAnswers(int wrongAnswers) { this.wrongAnswers = wrongAnswers; }
    public double getScore() { return score == null ? 0 : score; }
    public void setScore(double score) { this.score = score; }
    public String getQuizMode() { return quizMode; }
    public void setQuizMode(String quizMode) { this.quizMode = quizMode; }
    public Integer getChallengeSeconds() { return challengeSeconds; }
    public void setChallengeSeconds(Integer challengeSeconds) { this.challengeSeconds = challengeSeconds; }
    public int getMaxCombo() { return maxCombo == null ? 0 : maxCombo; }
    public void setMaxCombo(int maxCombo) { this.maxCombo = maxCombo; }
    public Instant getCreatedAt() { return createdAt; }
}
