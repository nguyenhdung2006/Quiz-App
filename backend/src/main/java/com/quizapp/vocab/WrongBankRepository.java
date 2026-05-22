package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WrongBankRepository extends JpaRepository<WrongBankEntry, Long> {
    List<WrongBankEntry> findByUserOrderByCreatedAtDesc(AppUser user);
    Optional<WrongBankEntry> findByUserAndWord(AppUser user, VocabularyWord word);
    void deleteByUserAndWord(AppUser user, VocabularyWord word);
}
