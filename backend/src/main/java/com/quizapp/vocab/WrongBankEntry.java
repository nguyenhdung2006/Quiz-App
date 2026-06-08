package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
        name = "wrong_bank",
        uniqueConstraints = @UniqueConstraint(name = "ux_wrong_bank_user_word", columnNames = {"user_id", "word_id"})
)
public class WrongBankEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id")
    private VocabularyWord word;

    private Boolean mastered = false;
    private Instant createdAt;
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

    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public VocabularyWord getWord() { return word; }
    public void setWord(VocabularyWord word) { this.word = word; }
    public boolean isMastered() { return Boolean.TRUE.equals(mastered); }
    public void setMastered(boolean mastered) { this.mastered = mastered; }
}
