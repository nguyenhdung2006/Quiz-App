package com.quizapp.vocab;

import com.quizapp.user.AppUser;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AchievementService {
    private final AchievementRepository achievements;
    private final UserAchievementRepository userAchievements;

    public AchievementService(
            AchievementRepository achievements,
            UserAchievementRepository userAchievements
    ) {
        this.achievements = achievements;
        this.userAchievements = userAchievements;
    }

    public List<UserAchievement> listUnlocked(AppUser user) {
        return userAchievements.findByUserOrderByUnlockedAtDesc(user);
    }

    public long countUnlocked(AppUser user) {
        return userAchievements.countByUser(user);
    }

    public int unlock(AppUser user, String code) {
        Achievement achievement = achievements.findByCode(code)
                .orElseGet(() -> achievements.save(defaultAchievement(code)));
        UserAchievementId id = new UserAchievementId(user.getId(), achievement.getId());
        if (userAchievements.existsById(id)) return 0;

        UserAchievement unlocked = new UserAchievement();
        unlocked.setId(id);
        unlocked.setUser(user);
        unlocked.setAchievement(achievement);
        userAchievements.save(unlocked);
        user.setXp(user.getXp() + achievement.getXpReward());
        user.setLevel(Math.max(1, user.getXp() / 250 + 1));
        return achievement.getXpReward();
    }

    private Achievement defaultAchievement(String code) {
        Achievement achievement = new Achievement();
        achievement.setCode(code);
        switch (code) {
            case "FIRST_WORD" -> {
                achievement.setName("First Word");
                achievement.setDescription("Add your first vocabulary word.");
                achievement.setXpReward(10);
            }
            case "FIRST_QUIZ" -> {
                achievement.setName("First Quiz");
                achievement.setDescription("Complete your first quiz round.");
                achievement.setXpReward(20);
            }
            case "PERFECT_ROUND" -> {
                achievement.setName("Perfect Round");
                achievement.setDescription("Finish a quiz with every answer correct.");
                achievement.setXpReward(50);
            }
            case "COMBO_10" -> {
                achievement.setName("Combo 10");
                achievement.setDescription("Reach a 10-answer combo.");
                achievement.setXpReward(40);
            }
            case "DAILY_CHALLENGE" -> {
                achievement.setName("Daily Challenger");
                achievement.setDescription("Complete a daily challenge.");
                achievement.setXpReward(30);
            }
            default -> {
                achievement.setName(code);
                achievement.setDescription("Unlocked through learning activity.");
                achievement.setXpReward(0);
            }
        }
        return achievement;
    }
}
