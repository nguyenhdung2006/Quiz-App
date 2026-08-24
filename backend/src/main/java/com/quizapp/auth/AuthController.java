package com.quizapp.auth;

import java.util.Map;
import com.quizapp.user.CurrentUserService;
import com.quizapp.user.ProfileDto;
import com.quizapp.user.ProfileRequest;
import com.quizapp.user.ProfileSanitizer;
import com.quizapp.user.AppUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.ResponseEntity;

@RestController
public class AuthController {
    private static final String SYNC_REVISION_HEADER = "X-Sync-Revision";
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
    ResponseEntity<ProfileDto> updateProfile(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody ProfileRequest request
    ) {
        AppUser user = currentUsers.requireUser(principal);
        if (request.name() != null && !request.name().isBlank()) {
            user.setDisplayName(ProfileSanitizer.displayName(request.name(), user.getDisplayName()));
        }
        if (request.avatar() != null) {
            user.setAvatarUrl(ProfileSanitizer.requireSafeAvatar(request.avatar()));
        } else {
            user.setAvatarUrl(ProfileSanitizer.avatarOrDefault(user.getAvatarUrl()));
        }
        user.setBirthday(request.birthday());
        user.setGender(ProfileSanitizer.singleLine(request.gender(), 40));
        user.setLearningGoal(ProfileSanitizer.singleLine(request.goal(), 160));
        user.setBio(ProfileSanitizer.multiLine(request.bio(), 2_000));
        long revision = user.incrementSyncRevision();
        return ResponseEntity.ok()
                .header(SYNC_REVISION_HEADER, String.valueOf(revision))
                .body(ProfileDto.from(user));
    }
}
