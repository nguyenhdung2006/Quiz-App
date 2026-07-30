package com.quizapp.auth;

import jakarta.servlet.http.HttpServletResponse;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CsrfController {
    private static final String CSRF_HEADER_NAME = "X-XSRF-TOKEN";
    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";

    @Value("${server.servlet.session.cookie.same-site:lax}")
    private String sessionCookieSameSite;

    @Value("${server.servlet.session.cookie.secure:false}")
    private boolean sessionCookieSecure;

    @Value("${server.servlet.session.cookie.path:/}")
    private String sessionCookiePath;

    @GetMapping("/api/csrf")
    public CsrfResponse csrf(CsrfToken token, HttpServletResponse response) {
        ResponseCookie csrfCookie = ResponseCookie.from(CSRF_COOKIE_NAME, token.getToken())
                .httpOnly(false)
                .secure(sessionCookieSecure)
                .sameSite(normalizeSameSite(sessionCookieSameSite))
                .path(sessionCookiePath)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, csrfCookie.toString());
        return new CsrfResponse(
                CSRF_HEADER_NAME,
                token.getParameterName(),
                token.getToken()
        );
    }

    public record CsrfResponse(
            String headerName,
            String parameterName,
            String token
    ) {
    }

    private String normalizeSameSite(String value) {
        String normalized = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "none" -> "None";
            case "strict" -> "Strict";
            default -> "Lax";
        };
    }
}
