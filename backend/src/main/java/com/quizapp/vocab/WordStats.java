package com.quizapp.vocab;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "word_stats")
public class WordStats {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", unique = true)
    private VocabularyWord word;

    private Integer seen = 0;
    private Integer correct = 0;
    private Integer wrong = 0;

    @Column(name = "current_streak")
    private Integer currentStreak = 0;

    @Column(name = "best_streak")
    private Integer bestStreak = 0;

    @Column(name = "mastery_level")
    private Integer masteryLevel = 0;

    @Column(name = "last_reviewed")
    private Instant lastReviewed;

    @Column(name = "next_review")
    private Instant nextReview;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public VocabularyWord getWord() { return word; }
    public void setWord(VocabularyWord word) { this.word = word; }
    public int getSeen() { return seen == null ? 0 : seen; }
    public void setSeen(int seen) { this.seen = seen; }
    public int getCorrect() { return correct == null ? 0 : correct; }
    public void setCorrect(int correct) { this.correct = correct; }
    public int getWrong() { return wrong == null ? 0 : wrong; }
    public void setWrong(int wrong) { this.wrong = wrong; }
    public int getCurrentStreak() { return currentStreak == null ? 0 : currentStreak; }
    public void setCurrentStreak(int currentStreak) { this.currentStreak = currentStreak; }
    public int getBestStreak() { return bestStreak == null ? 0 : bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }
    public int getMasteryLevel() { return masteryLevel == null ? 0 : masteryLevel; }
    public void setMasteryLevel(int masteryLevel) { this.masteryLevel = masteryLevel; }
    public Instant getLastReviewed() { return lastReviewed; }
    public void setLastReviewed(Instant lastReviewed) { this.lastReviewed = lastReviewed; }
    public Instant getNextReview() { return nextReview; }
    public void setNextReview(Instant nextReview) { this.nextReview = nextReview; }
}
