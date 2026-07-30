package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class CsrfSecurityTests {
    private static final String ALLOWED_ORIGIN = "http://localhost:5500";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void csrfEndpointIssuesReadableTokenWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/csrf"))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(jsonPath("$.headerName", is("X-XSRF-TOKEN")))
                .andExpect(jsonPath("$.parameterName", is("_csrf")))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void unsafeRequestWithoutCsrfIsForbiddenAsJsonAndDoesNotMutateData() throws Exception {
        String email = "csrf-missing@example.com";

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validWordJson("missing-token")))
                .andExpect(status().isForbidden())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString(MediaType.APPLICATION_JSON_VALUE)))
                .andExpect(jsonPath("$.message", is("Forbidden.")))
                .andExpect(jsonPath("$.errors[0]", is("Access denied.")));

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(0)));
    }

    @Test
    void unsafeRequestWithInvalidCsrfIsForbiddenAndValidCsrfCanWrite() throws Exception {
        String email = "csrf-valid-invalid@example.com";

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .with(csrf().useInvalidToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validWordJson("invalid-token")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Forbidden.")));

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validWordJson("valid-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("valid-token")));
    }

    @Test
    void safeMethodsAndOauthEntrypointsDoNotRequireCsrf() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser("csrf-safe-get@example.com")))
                .andExpect(status().isOk());

        mockMvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection());
    }

    @Test
    void validCsrfTokenDoesNotAuthenticateAnonymousUnsafeRequests() throws Exception {
        mockMvc.perform(post("/api/vocab")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validWordJson("anonymous-csrf")))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string(HttpHeaders.LOCATION, containsString("/oauth2/authorization/google")));
    }

    @Test
    void logoutRequiresCsrfAndReturnsNoContentWhenValid() throws Exception {
        mockMvc.perform(post("/logout")
                        .with(oauthUser("logout-missing@example.com")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Forbidden.")));

        mockMvc.perform(post("/logout")
                        .with(oauthUser("logout-invalid@example.com"))
                        .with(csrf().useInvalidToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Forbidden.")));

        mockMvc.perform(post("/logout")
                        .with(oauthUser("logout-valid@example.com"))
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void corsPreflightAllowsTrustedOriginAndCsrfHeaderOnlyFromConfiguredOrigins() throws Exception {
        mockMvc.perform(options("/api/vocab")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type, X-XSRF-TOKEN"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, containsString("X-XSRF-TOKEN")))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, not("*")));

        mockMvc.perform(options("/api/vocab")
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type, X-XSRF-TOKEN"))
                .andExpect(status().isForbidden());
    }

    private String validWordJson(String eng) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "eng", eng,
                "vie", "nghia hop le",
                "pos", "n",
                "tag", "csrf"
        ));
    }

    private static RequestPostProcessor oauthUser(String email) {
        return oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "CSRF User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
    }
}
