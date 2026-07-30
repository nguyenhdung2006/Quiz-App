package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VocabularyRepository extends JpaRepository<VocabularyWord, Long> {
    List<VocabularyWord> findByUserOrderByCreatedAtDesc(AppUser user);
    Optional<VocabularyWord> findByIdAndUser(Long id, AppUser user);
    Optional<VocabularyWord> findByUserAndWordUid(AppUser user, UUID wordUid);
    Optional<VocabularyWord> findByUserAndEngIgnoreCase(AppUser user, String eng);
}
