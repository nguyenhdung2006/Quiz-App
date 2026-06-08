package com.quizapp.user;

import java.time.LocalDate;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
    private static final Logger log = LoggerFactory.getLogger(CurrentUserService.class);
    private final AppUserRepository users;

    public CurrentUserService(AppUserRepository users) {
        this.users = users;
    }

    @Transactional
    public AppUser requireUser(OAuth2User principal) {
        if (principal == null) {
            log.warn("[AUTH] Unauthorized access - no OAuth2 principal");
            throw new IllegalStateException("Authentication is required.");
        }

        String email = safe(principal.getAttribute("email")).toLowerCase();
        String subject = safe(principal.getAttribute("sub"));
        if (email.isBlank()) {
            log.warn("[AUTH] OAuth failure - no email provided by provider subject={}", subject);
            throw new IllegalStateException("Google account did not provide an email.");
        }

        Optional<AppUser> existing = !subject.isBlank()
                ? users.findByGoogleSubject(subject)
                : Optional.empty();
        AppUser user = existing.or(() -> users.findByEmailIgnoreCase(email)).orElseGet(AppUser::new);
        boolean isNew = user.getId() == null;

        user.setEmail(email);
        if (!subject.isBlank()) user.setGoogleSubject(subject);
        if (isBlank(user.getDisplayName())) user.setDisplayName(safe(principal.getAttribute("name")));
        if (isBlank(user.getAvatarUrl())) user.setAvatarUrl(safe(principal.getAttribute("picture")));
        user.setLastActiveDate(LocalDate.now());
        AppUser saved = users.save(user);
        if (isNew) {
            log.info("[AUTH] New user created userId={}", saved.getId());
        } else {
            log.info("[AUTH] Login success userId={}", saved.getId());
        }
        return saved;
    }

    @Transactional
    public AppUser requireAdmin(OAuth2User principal) {
        AppUser user = requireUser(principal);
        if (!"ADMIN".equalsIgnoreCase(safe(user.getRole()))) {
            log.warn("[AUTH] Admin access denied userId={} role={}", user.getId(), user.getRole());
            throw new AccessDeniedException("Admin role is required.");
        }
        log.info("[AUTH] Admin access granted userId={}", user.getId());
        return user;
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
