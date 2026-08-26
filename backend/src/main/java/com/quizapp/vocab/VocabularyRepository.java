package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
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

    @EntityGraph(attributePaths = "stats")
    List<VocabularyWord> findByUserAndIdIn(AppUser user, Collection<Long> ids);

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

    @Query("""
            select w from VocabularyWord w
            left join fetch w.stats s
            where w.user = :user
              and s.nextReview is not null
              and s.nextReview <= :now
              and (:tag is null or lower(coalesce(w.tag, '')) = :tag)
              and (:level is null or lower(coalesce(w.level, '')) = :level)
            order by
              case when (
                100 - (case
                  when coalesce(s.masteryLevel, 0) < 0 then 0
                  when coalesce(s.masteryLevel, 0) > 5 then 5
                  else coalesce(s.masteryLevel, 0)
                end) * 20
                + (case
                  when coalesce(s.wrong, 0) < 0 then 0
                  when coalesce(s.wrong, 0) >= 5 then 30
                  else coalesce(s.wrong, 0) * 6
                end)
                + (case
                  when s.nextReview <= :sixDaysAgo then 30
                  when s.nextReview <= :fiveDaysAgo then 25
                  when s.nextReview <= :fourDaysAgo then 20
                  when s.nextReview <= :threeDaysAgo then 15
                  when s.nextReview <= :twoDaysAgo then 10
                  when s.nextReview <= :oneDayAgo then 5
                  else 0
                end)
              ) >= 100 then 100 else (
                100 - (case
                  when coalesce(s.masteryLevel, 0) < 0 then 0
                  when coalesce(s.masteryLevel, 0) > 5 then 5
                  else coalesce(s.masteryLevel, 0)
                end) * 20
                + (case
                  when coalesce(s.wrong, 0) < 0 then 0
                  when coalesce(s.wrong, 0) >= 5 then 30
                  else coalesce(s.wrong, 0) * 6
                end)
                + (case
                  when s.nextReview <= :sixDaysAgo then 30
                  when s.nextReview <= :fiveDaysAgo then 25
                  when s.nextReview <= :fourDaysAgo then 20
                  when s.nextReview <= :threeDaysAgo then 15
                  when s.nextReview <= :twoDaysAgo then 10
                  when s.nextReview <= :oneDayAgo then 5
                  else 0
                end)
              ) end desc,
              w.createdAt desc
            """)
    List<VocabularyWord> findDueForReviewLimited(
            @Param("user") AppUser user,
            @Param("now") Instant now,
            @Param("oneDayAgo") Instant oneDayAgo,
            @Param("twoDaysAgo") Instant twoDaysAgo,
            @Param("threeDaysAgo") Instant threeDaysAgo,
            @Param("fourDaysAgo") Instant fourDaysAgo,
            @Param("fiveDaysAgo") Instant fiveDaysAgo,
            @Param("sixDaysAgo") Instant sixDaysAgo,
            @Param("tag") String tag,
            @Param("level") String level,
            Pageable pageable
    );

    @Query("""
            select count(w) from VocabularyWord w
            join w.stats s
            where w.user = :user
              and s.nextReview is not null
              and s.nextReview <= :now
            """)
    long countDueForReview(@Param("user") AppUser user, @Param("now") Instant now);
}
