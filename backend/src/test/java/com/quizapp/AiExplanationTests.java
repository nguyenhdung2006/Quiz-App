package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.ai.AiExplanationClient;
import com.quizapp.ai.ExplainWrongAnswerRequest;
import com.quizapp.ai.ExplainWrongAnswerResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "ai.openai.api-key=test-key",
        "ai.model=test-model"
})
@AutoConfigureMockMvc
class AiExplanationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiExplanationClient aiClient;

    @Test
    void explainWrongAnswerUsesConfiguredAiClientWithoutCallingInternet() throws Exception {
        when(aiClient.isConfigured()).thenReturn(true);
        when(aiClient.explain(any(ExplainWrongAnswerRequest.class))).thenReturn(new ExplainWrongAnswerResponse(
                "negotiate",
                "dam phan",
                "Ban chon sai vi nham nghia trong ngu canh.",
                "Use negotiate when people discuss to reach an agreement.",
                "They negotiate a fair price.",
                "Nho negotiate gan voi meeting va agreement.",
                List.of("negotiate a deal", "negotiate with a client"),
                "Khong dung negotiate cho mot quyet dinh ca nhan khong co thoa thuan.",
                "openai"
        ));

        mockMvc.perform(post("/api/ai/explain-wrong-answer")
                        .with(oauthUser("ai-user@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.word", is("negotiate")))
                .andExpect(jsonPath("$.source", is("openai")))
                .andExpect(jsonPath("$.collocations[0]", is("negotiate a deal")));

        verify(aiClient).explain(any(ExplainWrongAnswerRequest.class));
    }

    @Test
    void invalidExplainRequestReturnsUnifiedValidationError() throws Exception {
        mockMvc.perform(post("/api/ai/explain-wrong-answer")
                        .with(oauthUser("ai-validation@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "word": "",
                                  "correctAnswer": ""
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Validation failed.")))
                .andExpect(jsonPath("$.errors", hasItem(containsString("word:"))))
                .andExpect(jsonPath("$.errors", hasItem(containsString("correctAnswer:"))));
    }

    private Map<String, Object> validRequest() {
        return Map.of(
                "word", "negotiate",
                "userAnswer", "thuong mai",
                "correctAnswer", "dam phan",
                "questionMode", "eng",
                "tag", "business",
                "level", "B2",
                "example", "They negotiate a fair price.",
                "note", "Business vocabulary."
        );
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
