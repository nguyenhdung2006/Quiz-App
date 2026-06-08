package com.quizapp.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "google_subject", unique = true)
    private String googleSubject;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    private String role = "USER";
    private Integer xp = 0;
    private Integer level = 1;
    private Integer streak = 0;

    @Column(name = "best_streak")
    private Integer bestStreak = 0;

    private LocalDate birthday;
    private String gender;

    @Column(name = "learning_goal")
    private String learningGoal;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    @Column(name = "sync_revision", nullable = false)
    private Long syncRevision = 0L;

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
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getGoogleSubject() { return googleSubject; }
    public void setGoogleSubject(String googleSubject) { this.googleSubject = googleSubject; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public int getXp() { return xp == null ? 0 : xp; }
    public void setXp(int xp) { this.xp = xp; }
    public int getLevel() { return level == null || level < 1 ? 1 : level; }
    public void setLevel(int level) { this.level = level; }
    public int getStreak() { return streak == null ? 0 : streak; }
    public void setStreak(int streak) { this.streak = streak; }
    public int getBestStreak() { return bestStreak == null ? 0 : bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }
    public LocalDate getBirthday() { return birthday; }
    public void setBirthday(LocalDate birthday) { this.birthday = birthday; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getLearningGoal() { return learningGoal; }
    public void setLearningGoal(String learningGoal) { this.learningGoal = learningGoal; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public LocalDate getLastActiveDate() { return lastActiveDate; }
    public void setLastActiveDate(LocalDate lastActiveDate) { this.lastActiveDate = lastActiveDate; }
    public long getSyncRevision() { return syncRevision == null ? 0L : syncRevision; }
    public void setSyncRevision(long syncRevision) { this.syncRevision = Math.max(0L, syncRevision); }
    public long incrementSyncRevision() {
        long next = getSyncRevision() + 1L;
        setSyncRevision(next);
        return next;
    }
}
