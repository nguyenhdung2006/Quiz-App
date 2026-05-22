package com.quizapp.user;

import java.time.LocalDate;

public record ProfileDto(
        boolean authenticated,
        Long id,
        String name,
        String email,
        String avatar,
        LocalDate birthday,
        String gender,
        String goal,
        String bio,
        int xp,
        int level,
        int streak,
        int bestStreak
) {
    public static ProfileDto from(AppUser user) {
        return new ProfileDto(
                true,
                user.getId(),
                user.getDisplayName(),
                user.getEmail(),
                user.getAvatarUrl(),
                user.getBirthday(),
                user.getGender(),
                user.getLearningGoal(),
                user.getBio(),
                user.getXp(),
                user.getLevel(),
                user.getStreak(),
                user.getBestStreak()
        );
    }
}
