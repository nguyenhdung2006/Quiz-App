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
                ProfileSanitizer.displayName(user.getDisplayName(), "Vocabulary Runner"),
                user.getEmail(),
                ProfileSanitizer.avatarOrDefault(user.getAvatarUrl()),
                user.getBirthday(),
                ProfileSanitizer.singleLine(user.getGender(), 40),
                ProfileSanitizer.singleLine(user.getLearningGoal(), 160),
                ProfileSanitizer.multiLine(user.getBio(), 2_000),
                user.getXp(),
                user.getLevel(),
                user.getStreak(),
                user.getBestStreak()
        );
    }
}
