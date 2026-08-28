package com.quizapp;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.ai.AiExplanationClient;
import com.quizapp.ai.AiExplanationService;
import com.quizapp.ai.ExplainWrongAnswerRequest;
import com.quizapp.health.HealthCounterService;
import com.quizapp.observability.RequestCorrelationFilter;
import com.quizapp.vocab.QuizHistoryRepository;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "ai.rate-limit.explain.per-minute=1",
        "ai.rate-limit.explain.per-day=100",
        "ai.rate-limit.minute-window=1s"
})
@AutoConfigureMockMvc
class ObservabilityAndRateLimitTests {
    private static final String UUID_PATTERN =
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MeterRegistry meterRegistry;

    @Autowired
    private HealthCounterService healthCounters;

    @Autowired
    private AiExplanationService aiExplanationService;

    @MockitoBean
    private AiExplanationClient aiExplanationClient;

    @MockitoBean
    private QuizHistoryRepository quizHistory;

    @Test
    void requestWithoutIdReceivesGeneratedRequestId() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string(RequestCorrelationFilter.REQUEST_ID_HEADER, matchesPattern(UUID_PATTERN)));
    }

    @Test
    void validRequestIdIsPreserved() throws Exception {
        mockMvc.perform(get("/api/health")
                        .header(RequestCorrelationFilter.REQUEST_ID_HEADER, "client-trace_123"))
                .andExpect(status().isOk())
                .andExpect(header().string(RequestCorrelationFilter.REQUEST_ID_HEADER, "client-trace_123"));
    }

    @Test
    void unsafeRequestIdIsReplaced() throws Exception {
        mockMvc.perform(get("/api/health")
                        .header(RequestCorrelationFilter.REQUEST_ID_HEADER, "bad\r\nInjected: value"))
                .andExpect(status().isOk())
                .andExpect(header().string(RequestCorrelationFilter.REQUEST_ID_HEADER, matchesPattern(UUID_PATTERN)));
    }

    @Test
    void requestIdIsAvailableInMdcAndClearedAfterRequest() throws Exception {
        RequestCorrelationFilter filter = new RequestCorrelationFilter();
        org.springframework.mock.web.MockHttpServletRequest request =
                new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/health");
        request.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "trace-mdc");
        org.springframework.mock.web.MockHttpServletResponse response =
                new org.springframework.mock.web.MockHttpServletResponse();
        AtomicReference<String> insideRequest = new AtomicReference<>();

        filter.doFilter(request, response, (ServletRequest servletRequest, ServletResponse servletResponse) ->
                insideRequest.set(MDC.get(RequestCorrelationFilter.MDC_REQUEST_ID)));

        org.assertj.core.api.Assertions.assertThat(insideRequest.get()).isEqualTo("trace-mdc");
        org.assertj.core.api.Assertions.assertThat(MDC.get(RequestCorrelationFilter.MDC_REQUEST_ID)).isNull();
    }

    @Test
    void anonymousActuatorMetricsEndpointIsProtected() throws Exception {
        mockMvc.perform(get("/actuator/metrics/wordarena.ai.failures"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedActuatorMetricsEndpointIncludesApplicationMetrics() throws Exception {
        healthCounters.incrementAiFailures();

        mockMvc.perform(get("/actuator/metrics/wordarena.ai.failures")
                        .with(oauthUser("metrics-reader@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("wordarena.ai.failures")));
    }

    @Test
    void requestMetricsRecord4xxAnd5xxStatusGroups() throws Exception {
        double fourXxBefore = counter("wordarena.http.errors", "statusGroup", "4xx");
        double fiveXxBefore = counter("wordarena.http.errors", "statusGroup", "5xx");

        mockMvc.perform(get("/does-not-exist")
                        .with(oauthUser("request-4xx@example.com")))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/test/boom")
                        .with(oauthUser("request-5xx@example.com")))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message", is("Something went wrong.")));

        org.assertj.core.api.Assertions.assertThat(counter("wordarena.http.errors", "statusGroup", "4xx"))
                .isGreaterThan(fourXxBefore);
        org.assertj.core.api.Assertions.assertThat(counter("wordarena.http.errors", "statusGroup", "5xx"))
                .isGreaterThan(fiveXxBefore);
    }

    @Test
    void syncConflictIncrementsMetric() throws Exception {
        double before = counter("wordarena.sync.conflicts");

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("metrics-sync-conflict@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "syncContractVersion": 2,
                                  "vocab": []
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("SYNC_REVISION_CONFLICT")));

        org.assertj.core.api.Assertions.assertThat(counter("wordarena.sync.conflicts")).isGreaterThan(before);
    }

    @Test
    void quizFailureIncrementsMetric() throws Exception {
        String email = "metrics-quiz-failure@example.com";
        long wordId = createWord(email, "focus", "tap trung");
        MvcResult issued = mockMvc.perform(post("/api/quiz/attempts")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "quizMode", "quiz",
                                "items", java.util.List.of(Map.of("wordId", wordId, "questionMode", "eng"))
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String attemptId = objectMapper.readTree(issued.getResponse().getContentAsString()).path("attemptId").asText();
        when(quizHistory.save(any())).thenThrow(new RuntimeException("storage unavailable"));
        double before = counter("wordarena.quiz.failures");

        mockMvc.perform(post("/api/quiz/attempts/" + attemptId + "/submit")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "answers", java.util.List.of(Map.of("ordinal", 0, "selectedAnswer", "wrong"))
                        ))))
                .andExpect(status().isInternalServerError());

        org.assertj.core.api.Assertions.assertThat(counter("wordarena.quiz.failures")).isGreaterThan(before);
    }

    @Test
    void aiFailureIncrementsMetricThroughFallbackWrapper() {
        when(aiExplanationClient.isConfigured()).thenReturn(true);
        when(aiExplanationClient.explain(any(ExplainWrongAnswerRequest.class)))
                .thenThrow(new RuntimeException("provider unavailable"));
        double before = counter("wordarena.ai.failures");

        aiExplanationService.explainWrongAnswer(new ExplainWrongAnswerRequest(
                "focus",
                "wrong",
                "tap trung",
                "eng",
                "study",
                "A2",
                "Focus on one task.",
                ""
        ));

        org.assertj.core.api.Assertions.assertThat(counter("wordarena.ai.failures")).isGreaterThan(before);
    }

    @Test
    void aiRateLimitReturns429IncrementsMetricAndResetsAfterWindow() throws Exception {
        double before = counter("wordarena.rate_limit.hits");

        performExplain("metrics-rate-limit@example.com").andExpect(status().isOk());
        performExplain("metrics-rate-limit@example.com").andExpect(status().isTooManyRequests());

        org.assertj.core.api.Assertions.assertThat(counter("wordarena.rate_limit.hits")).isGreaterThan(before);

        Thread.sleep(1_100);
        performExplain("metrics-rate-limit@example.com").andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions performExplain(String email) throws Exception {
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

    private long createWord(String email, String eng, String vie) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", eng,
                                "vie", vie,
                                "pos", "n",
                                "tag", "test"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private double counter(String name) {
        return meterRegistry.find(name).counter() == null ? 0 : meterRegistry.find(name).counter().count();
    }

    private double counter(String name, String tagKey, String tagValue) {
        return meterRegistry.find(name).tag(tagKey, tagValue).counter() == null
                ? 0
                : meterRegistry.find(name).tag(tagKey, tagValue).counter().count();
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Metrics User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }

    @TestConfiguration
    static class ObservabilityTestConfig {
        @RestController
        static class BoomController {
            @GetMapping("/api/test/boom")
            void boom(@AuthenticationPrincipal OAuth2User principal) {
                throw new RuntimeException("boom");
            }
        }
    }
}
