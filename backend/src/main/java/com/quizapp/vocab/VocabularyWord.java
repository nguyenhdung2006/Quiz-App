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
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
        name = "vocabulary",
        uniqueConstraints = @UniqueConstraint(name = "ux_vocabulary_user_eng", columnNames = {"user_id", "eng"})
)
public class VocabularyWord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(nullable = false)
    private String eng;

    @Column(nullable = false)
    private String vie;

    private String pos = "n";
    private String tag;

    private String ipa;

    @Column(name = "word_level")
    private String level;

    @Column(columnDefinition = "TEXT")
    private String context;

    @Column(columnDefinition = "TEXT")
    private String example;

    @Column(name = "example_meaning", columnDefinition = "TEXT")
    private String exampleMeaning;

    @Column(columnDefinition = "TEXT")
    private String collocation;

    @Column(columnDefinition = "TEXT")
    private String synonyms;

    @Column(columnDefinition = "TEXT")
    private String antonyms;

    @Column(name = "common_mistake", columnDefinition = "TEXT")
    private String commonMistake;

    @Column(columnDefinition = "TEXT")
    private String note;

    private boolean favorite;
    private boolean mastered;

    @OneToOne(mappedBy = "word", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private WordStats stats;

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

    public Long getId() { return id; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public String getEng() { return eng; }
    public void setEng(String eng) { this.eng = eng; }
    public String getVie() { return vie; }
    public void setVie(String vie) { this.vie = vie; }
    public String getPos() { return pos; }
    public void setPos(String pos) { this.pos = pos; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
    public String getIpa() { return ipa; }
    public void setIpa(String ipa) { this.ipa = ipa; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public String getContext() { return context; }
    public void setContext(String context) { this.context = context; }
    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
    public String getExampleMeaning() { return exampleMeaning; }
    public void setExampleMeaning(String exampleMeaning) { this.exampleMeaning = exampleMeaning; }
    public String getCollocation() { return collocation; }
    public void setCollocation(String collocation) { this.collocation = collocation; }
    public String getSynonyms() { return synonyms; }
    public void setSynonyms(String synonyms) { this.synonyms = synonyms; }
    public String getAntonyms() { return antonyms; }
    public void setAntonyms(String antonyms) { this.antonyms = antonyms; }
    public String getCommonMistake() { return commonMistake; }
    public void setCommonMistake(String commonMistake) { this.commonMistake = commonMistake; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public boolean isFavorite() { return favorite; }
    public void setFavorite(boolean favorite) { this.favorite = favorite; }
    public boolean isMastered() { return mastered; }
    public void setMastered(boolean mastered) { this.mastered = mastered; }
    public WordStats getStats() { return stats; }
    public void setStats(WordStats stats) {
        this.stats = stats;
        if (stats != null) stats.setWord(this);
    }
}
