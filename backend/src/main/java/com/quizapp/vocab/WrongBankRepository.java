package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WrongBankRepository extends JpaRepository<WrongBankEntry, Long> {
    @EntityGraph(attributePaths = {"word", "word.stats"})
    List<WrongBankEntry> findByUserOrderByCreatedAtDesc(AppUser user);

    Optional<WrongBankEntry> findByUserAndWord(AppUser user, VocabularyWord word);

    @EntityGraph(attributePaths = {"word", "word.stats"})
    List<WrongBankEntry> findByUserAndWordIn(AppUser user, Collection<VocabularyWord> words);

    void deleteByUserAndWord(AppUser user, VocabularyWord word);
}
