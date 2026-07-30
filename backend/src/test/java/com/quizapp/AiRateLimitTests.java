package com.quizapp;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.ai.AiDeckGeneratorService;
import com.quizapp.ai.AiExplanationService;
import com.quizapp.ai.ExplainWrongAnswerRequest;
import com.quizapp.ai.ExplainWrongAnswerResponse;
import com.quizapp.ai.GenerateDeckRequest;
import com.quizapp.ai.GeneratedDeckResponse;
import com.quizapp.ai.GeneratedDeckWordDto;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "ai.rate-limit.explain.per-minute=2",
        "ai.rate-limit.explain.per-day=100",
        "ai.rate-limit.deck.per-minute=1",
        "ai.rate-limit.deck.per-day=100"
})
@AutoConfigureMockMvc
class AiRateLimitTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiExplanationService aiExplanation;

    @MockitoBean
    private AiDeckGeneratorService deckGenerator;

    @Test
    void explainLimitBlocksAfterConfiguredMinuteLimit() throws Exception {
        when(aiExplanation.explainWrongAnswer(any(ExplainWrongAnswerRequest.class))).thenReturn(explainResponse());

        performExplain("limit-explain@example.com").andExpect(status().isOk());
        performExplain("limit-explain@example.com").andExpect(status().isOk());
        performExplain("limit-explain@example.com")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("Rate limit exceeded")))
                .andExpect(jsonPath("$.message", is("Too many AI requests. Please try again later.")))
                .andExpect(jsonPath("$.retryAfterSeconds", greaterThanOrEqualTo(1)));

        verify(aiExplanation, times(2)).explainWrongAnswer(any(ExplainWrongAnswerRequest.class));
    }

    @Test
    void deckLimitIsTrackedSeparatelyFromExplainLimit() throws Exception {
        when(aiExplanation.explainWrongAnswer(any(ExplainWrongAnswerRequest.class))).thenReturn(explainResponse());
        when(deckGenerator.generateDeck(any(GenerateDeckRequest.class))).thenReturn(deckResponse());

        performExplain("separate-limits@example.com").andExpect(status().isOk());
        performExplain("separate-limits@example.com").andExpect(status().isOk());
        performDeck("separate-limits@example.com").andExpect(status().isOk());
        performDeck("separate-limits@example.com").andExpect(status().isTooManyRequests());

        verify(aiExplanation, times(2)).explainWrongAnswer(any(ExplainWrongAnswerRequest.class));
        verify(deckGenerator, times(1)).generateDeck(any(GenerateDeckRequest.class));
    }

    @Test
    void differentUsersHaveSeparateExplainLimits() throws Exception {
        when(aiExplanation.explainWrongAnswer(any(ExplainWrongAnswerRequest.class))).thenReturn(explainResponse());

        performExplain("first-ai-user@example.com").andExpect(status().isOk());
        performExplain("first-ai-user@example.com").andExpect(status().isOk());
        performExplain("second-ai-user@example.com").andExpect(status().isOk());
        performExplain("second-ai-user@example.com").andExpect(status().isOk());
        performExplain("first-ai-user@example.com").andExpect(status().isTooManyRequests());

        verify(aiExplanation, times(4)).explainWrongAnswer(any(ExplainWrongAnswerRequest.class));
    }

    @Test
    void rateLimitedDeckRequestDoesNotCallDeckServiceAgain() throws Exception {
        when(deckGenerator.generateDeck(any(GenerateDeckRequest.class))).thenReturn(deckResponse());

        performDeck("deck-blocked@example.com").andExpect(status().isOk());
        performDeck("deck-blocked@example.com").andExpect(status().isTooManyRequests());

        verify(deckGenerator, times(1)).generateDeck(any(GenerateDeckRequest.class));
    }

    private ResultActions performExplain(String email) throws Exception {
        return mockMvc.perform(post("/api/ai/explain-wrong-answer")
                .with(oauthUser(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "word", "negotiate",
                        "userAnswer", "trade",
                        "correctAnswer", "discuss to reach an agreement",
                        "questionMode", "eng",
                        "tag", "business",
                        "level", "B2",
                        "example", "They negotiate a fair price."
                ))));
    }

    private ResultActions performDeck(String email) throws Exception {
        return mockMvc.perform(post("/api/ai/generate-deck")
                .with(oauthUser(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "text", "Critical thinking improves concentration during academic reading.",
                        "targetLevel", "B2",
                        "maxWords", 5
                ))));
    }

    private ExplainWrongAnswerResponse explainResponse() {
        return new ExplainWrongAnswerResponse(
                "negotiate",
                "discuss to reach an agreement",
                "The selected answer does not match the context.",
                "Use negotiate when people discuss terms.",
                "They negotiate a fair price.",
                "Connect negotiate with agreement.",
                List.of("negotiate a deal"),
                "Do not use it for a solo decision.",
                "mock"
        );
    }

    private GeneratedDeckResponse deckResponse() {
        return new GeneratedDeckResponse(List.of(new GeneratedDeckWordDto(
                "concentration",
                "su tap trung",
                "noun",
                "B2",
                "Reading improves concentration.",
                "academic",
                "mock"
        )), "mock");
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "AI Rate User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
