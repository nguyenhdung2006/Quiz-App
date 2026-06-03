package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAchievementRepository extends JpaRepository<UserAchievement, UserAchievementId> {
    List<UserAchievement> findByUserOrderByUnlockedAtDesc(AppUser user);
    long countByUser(AppUser user);
}
