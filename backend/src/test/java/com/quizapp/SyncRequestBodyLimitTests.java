package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.config.SyncRequestBodyLimitFilter;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "app.sync.max-request-body-bytes=256"
})
@AutoConfigureMockMvc
class SyncRequestBodyLimitTests {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void normalSyncRequestBelowBodyLimitStillSucceeds() throws Exception {
        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("sync-body-limit-ok@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "syncContractVersion": 2,
                                  "expectedRevision": 0,
                                  "vocab": []
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(0)));
    }

    @Test
    void oversizedSyncRequestReturnsPayloadTooLarge() throws Exception {
        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("sync-body-limit-large@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "syncContractVersion": 2,
                                  "expectedRevision": 0,
                                  "vocab": [],
                                  "padding": "%s"
                                }
                                """.formatted("x".repeat(512))))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.message", is("Payload too large.")))
                .andExpect(jsonPath("$.errors[0]", containsString("256 bytes")));
    }

    @Test
    void oversizedMalformedSyncRequestIsRejectedBeforeJsonDeserialization() throws Exception {
        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("sync-body-limit-malformed@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "syncContractVersion": 2,
                                  "expectedRevision": 0,
                                  "vocab": [],
                                  "padding": "%s"
                                """.formatted("x".repeat(512))))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.message", is("Payload too large.")));
    }

    @Test
    void oversizedSyncRequestWithoutContentLengthIsRejectedWhileReadingBody() throws Exception {
        SyncRequestBodyLimitFilter filter = new SyncRequestBodyLimitFilter(new ObjectMapper(), 256);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/sync") {
            @Override
            public int getContentLength() {
                return -1;
            }

            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        request.setContentType(MediaType.APPLICATION_JSON_VALUE);
        request.setContent("""
                {
                  "syncContractVersion": 2,
                  "expectedRevision": 0,
                  "vocab": [],
                  "padding": "%s"
                }
                """.formatted("x".repeat(512)).getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> chainCalled.set(true));

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentAsString()).contains("Payload too large.");
        assertThat(chainCalled).isFalse();
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Test User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
