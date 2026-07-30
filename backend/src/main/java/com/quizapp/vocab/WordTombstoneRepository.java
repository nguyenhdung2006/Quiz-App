package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WordTombstoneRepository extends JpaRepository<WordTombstone, Long> {
    Optional<WordTombstone> findByUserAndWordUid(AppUser user, UUID wordUid);
    boolean existsByUserAndWordUid(AppUser user, UUID wordUid);
    List<WordTombstone> findByUserOrderByDeletedRevisionAscDeletedAtAsc(AppUser user);
    List<WordTombstone> findByUserAndWordUidIn(AppUser user, Collection<UUID> wordUids);
    List<WordTombstone> findByUserAndLegacyWordId(AppUser user, Long legacyWordId);
}
