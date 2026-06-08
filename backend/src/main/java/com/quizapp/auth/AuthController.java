package com.quizapp.auth;

import java.util.Map;
import com.quizapp.user.CurrentUserService;
import com.quizapp.user.ProfileDto;
import com.quizapp.user.ProfileRequest;
import com.quizapp.user.AppUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

@RestController
public class AuthController {
    private final CurrentUserService currentUsers;

    public AuthController(CurrentUserService currentUsers) {
        this.currentUsers = currentUsers;
    }

    @GetMapping("/api/me")
    Object currentUser(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) {
            return Map.of("authenticated", false);
        }

        return ProfileDto.from(currentUsers.requireUser(user));
    }

    @PutMapping("/api/profile")
    @Transactional
    ProfileDto updateProfile(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody ProfileRequest request
    ) {
        AppUser user = currentUsers.requireUser(principal);
        if (request.name() != null && !request.name().isBlank()) user.setDisplayName(request.name().trim());
        if (request.avatar() != null && !request.avatar().isBlank()) user.setAvatarUrl(request.avatar().trim());
        user.setBirthday(request.birthday());
        user.setGender(safe(request.gender()));
        user.setLearningGoal(safe(request.goal()));
        user.setBio(safe(request.bio()));
        user.incrementSyncRevision();
        return ProfileDto.from(user);
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
