package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WrongBankRepository extends JpaRepository<WrongBankEntry, Long> {
    @EntityGraph(attributePaths = {"word", "word.stats"})
    List<WrongBankEntry> findByUserOrderByCreatedAtDesc(AppUser user);

    @Query("select entry.word.id from WrongBankEntry entry where entry.user = :user order by entry.createdAt desc")
    List<Long> findWordIdsByUserOrderByCreatedAtDesc(@Param("user") AppUser user);

    Optional<WrongBankEntry> findByUserAndWord(AppUser user, VocabularyWord word);

    @EntityGraph(attributePaths = {"word", "word.stats"})
    List<WrongBankEntry> findByUserAndWordIn(AppUser user, Collection<VocabularyWord> words);

    void deleteByUserAndWord(AppUser user, VocabularyWord word);
}
