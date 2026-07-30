package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.ai.AiDeckGeneratorClient;
import com.quizapp.ai.GenerateDeckRequest;
import com.quizapp.ai.GeneratedDeckWordDto;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
class AiDeckGeneratorTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiDeckGeneratorClient aiClient;

    @Test
    void generateDeckUsesConfiguredAiClientWithoutCallingInternet() throws Exception {
        when(aiClient.isConfigured()).thenReturn(true);
        when(aiClient.generate(any(GenerateDeckRequest.class))).thenReturn(List.of(
                new GeneratedDeckWordDto(
                        "resilient",
                        "kiên cường",
                        "adj",
                        "B2",
                        "She stayed resilient after the hard exam.",
                        "mindset",
                        "openai"
                )
        ));

        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(oauthUser("deck-user@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "She stayed resilient after the hard exam.",
                                "targetLevel", "B2",
                                "maxWords", 10
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source", is("openai")))
                .andExpect(jsonPath("$.items[0].english", is("resilient")))
                .andExpect(jsonPath("$.items[0].vietnameseMeaning", is("kiên cường")))
                .andExpect(jsonPath("$.items[0].level", is("B2")));

        ArgumentCaptor<GenerateDeckRequest> requestCaptor = ArgumentCaptor.forClass(GenerateDeckRequest.class);
        verify(aiClient).generate(requestCaptor.capture());
        assertThat(requestCaptor.getValue().normalizedTargetLevel()).isEqualTo("B2");
        assertThat(requestCaptor.getValue().normalizedMaxWords()).isEqualTo(10);
    }

    @Test
    void emptyAiDeckResponseDoesNotInventFallbackWords() throws Exception {
        when(aiClient.isConfigured()).thenReturn(true);
        when(aiClient.generate(any(GenerateDeckRequest.class))).thenReturn(List.of());

        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(oauthUser("deck-empty-openai@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "Critical thinking improves concentration.",
                                "targetLevel", "B2"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source", is("openai")))
                .andExpect(jsonPath("$.items.length()", is(0)));
    }

    @Test
    void invalidGenerateDeckRequestReturnsUnifiedValidationError() throws Exception {
        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(oauthUser("deck-validation@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "text": ""
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Validation failed.")))
                .andExpect(jsonPath("$.errors", hasItem(containsString("text:"))));
    }

    @Test
    void generateDeckRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/ai/generate-deck")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "Useful vocabulary appears in this text."
                        ))))
                .andExpect(status().is3xxRedirection());
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "AI Deck User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
