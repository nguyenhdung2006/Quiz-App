package com.quizapp;

import static org.hamcrest.Matchers.containsString;
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
class AiExplanationFallbackTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void explainWrongAnswerFallsBackWhenOpenAiKeyIsMissing() throws Exception {
        mockMvc.perform(post("/api/ai/explain-wrong-answer")
                        .with(oauthUser("ai-fallback@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "word", "negotiate",
                                "userAnswer", "thuong mai",
                                "correctAnswer", "dam phan",
                                "questionMode", "eng",
                                "tag", "business",
                                "level", "B2",
                                "example", "They negotiate a fair price."
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.word", is("negotiate")))
                .andExpect(jsonPath("$.source", is("fallback")))
                .andExpect(jsonPath("$.whyWrong", containsString("đáp án đúng")));
    }

    private static RequestPostProcessor oauthUser(String email) {
        return oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "AI User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
    }
}
