package com.quizapp;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class HealthCheckTests {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ok")))
                .andExpect(jsonPath("$.app", is("quiz-app")));
    }

    @Test
    void actuatorHealthEndpointIsPublicAndMinimal() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")))
                .andExpect(jsonPath("$.components").doesNotExist())
                .andExpect(jsonPath("$.details").doesNotExist());
    }

    @Test
    void actuatorInfoEndpointExposesSafeMetadata() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app.name", is("WordArena")))
                .andExpect(jsonPath("$.app.version", is("0.0.1-SNAPSHOT")))
                .andExpect(jsonPath("$.app.environment", is("local")))
                .andExpect(jsonPath("$.ai.enabled", is(false)))
                .andExpect(jsonPath("$.flyway.enabled", is(false)))
                .andExpect(jsonPath("$.rateLimit.mode", is("in-memory")))
                .andExpect(jsonPath("$.rateLimit.distributed", is(false)));
    }
}
