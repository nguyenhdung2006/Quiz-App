package com.quizapp.auth;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    @GetMapping("/api/me")
    Map<String, Object> currentUser(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) {
            return Map.of("authenticated", false);
        }

        return Map.of(
                "authenticated", true,
                "name", safe(user.getAttribute("name")),
                "email", safe(user.getAttribute("email")),
                "avatar", safe(user.getAttribute("picture"))
        );
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
