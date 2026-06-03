package com.quizapp.vocab;

import java.time.Instant;

public record AchievementDto(
        String code,
        String name,
        String description,
        int xpReward,
        Instant unlockedAt
) {
    public static AchievementDto from(UserAchievement achievement) {
        Achievement source = achievement.getAchievement();
        return new AchievementDto(
                source.getCode(),
                source.getName(),
                source.getDescription(),
                source.getXpReward(),
                achievement.getUnlockedAt()
        );
    }
}
