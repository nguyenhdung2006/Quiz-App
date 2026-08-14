package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VocabularyRepository extends JpaRepository<VocabularyWord, Long> {
    @EntityGraph(attributePaths = "stats")
    List<VocabularyWord> findByUserOrderByCreatedAtDesc(AppUser user);

    @EntityGraph(attributePaths = "stats")
    Optional<VocabularyWord> findByIdAndUser(Long id, AppUser user);

    @EntityGraph(attributePaths = "stats")
    Optional<VocabularyWord> findByUserAndWordUid(AppUser user, UUID wordUid);

    @EntityGraph(attributePaths = "stats")
    Optional<VocabularyWord> findByUserAndEngIgnoreCase(AppUser user, String eng);

    @Query("""
            select w from VocabularyWord w
            left join fetch w.stats
            where w.user = :user
              and lower(w.eng) in :englishKeys
            """)
    List<VocabularyWord> findByUserAndEnglishLookupKeyIn(
            @Param("user") AppUser user,
            @Param("englishKeys") Collection<String> englishKeys
    );

    @Query("""
            select w from VocabularyWord w
            left join fetch w.stats s
            where w.user = :user
              and s.nextReview is not null
              and s.nextReview <= :now
              and (:tag is null or lower(coalesce(w.tag, '')) = :tag)
              and (:level is null or lower(coalesce(w.level, '')) = :level)
            order by w.createdAt desc
            """)
    List<VocabularyWord> findDueForReview(
            @Param("user") AppUser user,
            @Param("now") Instant now,
            @Param("tag") String tag,
            @Param("level") String level
    );
}
