package com.quizapp;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "ai.openai.api-key=",
        "ai.model=test-model"
})
@AutoConfigureMockMvc
class AiDeckGeneratorFallbackTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void generateDeckFallsBackWhenOpenAiKeyIsMissing() throws Exception {
        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(oauthUser("deck-fallback@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "The assignment has a deadline and attendance is important."
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source", is("fallback")))
                .andExpect(jsonPath("$.items.length()", greaterThan(0)))
                .andExpect(jsonPath("$.items[0].vietnameseMeaning", is("bài tập được giao")));
    }

    @Test
    void fallbackRespectsTargetCefrLevel() throws Exception {
        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(oauthUser("deck-b2@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "Critical thinking improves concentration and reduces distraction during academic reading.",
                                "targetLevel", "B2",
                                "maxWords", 10
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source", is("fallback")))
                .andExpect(jsonPath("$.items.length()", greaterThan(0)))
                .andExpect(jsonPath("$.items[0].english", is("critical thinking")))
                .andExpect(jsonPath("$.items[0].vietnameseMeaning", is("tư duy phản biện")))
                .andExpect(jsonPath("$.items[0].level", is("B2")));
    }

    @Test
    void fallbackReturnsEmptyWhenNoWordsMatchTargetLevel() throws Exception {
        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(oauthUser("deck-empty@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "The assignment has a deadline and attendance is important.",
                                "targetLevel", "C2",
                                "maxWords", 10
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source", is("fallback")))
                .andExpect(jsonPath("$.items.length()", is(0)));
    }

    private static RequestPostProcessor oauthUser(String email) {
        return oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "AI Deck User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
    }
}
