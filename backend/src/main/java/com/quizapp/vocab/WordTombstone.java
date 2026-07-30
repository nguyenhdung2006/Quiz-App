package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "word_tombstones",
        uniqueConstraints = @UniqueConstraint(
                name = "ux_word_tombstones_user_word_uid",
                columnNames = {"user_id", "word_uid"}
        )
)
public class WordTombstone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "word_uid", nullable = false)
    private UUID wordUid;

    @Column(name = "deleted_at", nullable = false)
    private Instant deletedAt;

    @Column(name = "deleted_revision", nullable = false)
    private Long deletedRevision;

    public Long getId() { return id; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public UUID getWordUid() { return wordUid; }
    public void setWordUid(UUID wordUid) { this.wordUid = wordUid; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public long getDeletedRevision() { return deletedRevision == null ? 0L : deletedRevision; }
    public void setDeletedRevision(long deletedRevision) {
        this.deletedRevision = Math.max(0L, deletedRevision);
    }
}
