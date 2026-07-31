package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class ProfileSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void profileUpdateRequiresAuthenticationAndCsrf() throws Exception {
        mockMvc.perform(put("/api/profile")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("No Auth", "images/icon.png")))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string(HttpHeaders.LOCATION, containsString("/oauth2/authorization/google")));

        mockMvc.perform(put("/api/profile")
                        .with(oauthUser("profile-csrf@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("No Csrf", "images/icon.png")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Forbidden.")));
    }

    @Test
    void profileUpdateOnlyMutatesAuthenticatedUser() throws Exception {
        mockMvc.perform(put("/api/profile")
                        .with(oauthUser("profile-owner-a@example.com"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("Owner A", "https://cdn.example.com/avatar-a.png")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("profile-owner-a@example.com")))
                .andExpect(jsonPath("$.name", is("Owner A")))
                .andExpect(jsonPath("$.avatar", is("https://cdn.example.com/avatar-a.png")));

        mockMvc.perform(get("/api/me")
                        .with(oauthUser("profile-owner-b@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("profile-owner-b@example.com")))
                .andExpect(jsonPath("$.name", not("Owner A")))
                .andExpect(jsonPath("$.avatar", is("https://example.com/avatar.png")));
    }

    @Test
    void profileUpdateRejectsUnsafeAvatarSchemesAndDataTypes() throws Exception {
        assertUnsafeAvatarRejected("javascript:alert(1)");
        assertUnsafeAvatarRejected("//evil.example/avatar.png");
        assertUnsafeAvatarRejected("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==");
        assertUnsafeAvatarRejected("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+");
    }

    @Test
    void profileUpdateAcceptsSafeRelativeHttpsAndBitmapDataAvatars() throws Exception {
        mockMvc.perform(put("/api/profile")
                        .with(oauthUser("profile-safe-relative@example.com"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("Safe Relative", "images/icon.png")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar", is("images/icon.png")));

        mockMvc.perform(put("/api/profile")
                        .with(oauthUser("profile-safe-https@example.com"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("Safe Https", "https://cdn.example.com/avatar.png")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar", is("https://cdn.example.com/avatar.png")));

        mockMvc.perform(put("/api/profile")
                        .with(oauthUser("profile-safe-data@example.com"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("Safe Data", "data:image/png;base64,iVBORw0KGgo=")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar", is("data:image/png;base64,iVBORw0KGgo=")));
    }

    @Test
    void oauthPictureIsSanitizedBeforeOutput() throws Exception {
        mockMvc.perform(get("/api/me")
                        .with(oauthUser("profile-oauth-unsafe@example.com", "javascript:alert(1)")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar", is("images/icon.png")));
    }

    private void assertUnsafeAvatarRejected(String avatar) throws Exception {
        mockMvc.perform(put("/api/profile")
                        .with(oauthUser("profile-unsafe-" + Math.abs(avatar.hashCode()) + "@example.com"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileJson("Unsafe Avatar", avatar)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Invalid avatar URL or data.")));
    }

    private String profileJson(String name, String avatar) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "name", name,
                "avatar", avatar,
                "birthday", "2000-01-01",
                "gender", "custom",
                "goal", "IELTS",
                "bio", "Learning profile"
        ));
    }

    private static RequestPostProcessor oauthUser(String email) {
        return oauthUser(email, "https://example.com/avatar.png");
    }

    private static RequestPostProcessor oauthUser(String email, String picture) {
        return oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Profile User");
            attributes.put("picture", picture);
        });
    }
}
