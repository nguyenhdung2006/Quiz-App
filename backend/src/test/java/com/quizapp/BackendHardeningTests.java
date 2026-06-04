package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class BackendHardeningTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void invalidWordRequestReturnsUnifiedValidationError() throws Exception {
        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser("validation@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "eng": "",
                                  "vie": "",
                                  "pos": "n"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Validation failed.")))
                .andExpect(jsonPath("$.errors", hasItem(containsString("eng:"))))
                .andExpect(jsonPath("$.errors", hasItem(containsString("vie:"))));
    }

    @Test
    void regularUserCannotImportAdminSampleWords() throws Exception {
        mockMvc.perform(post("/api/admin/sample-words")
                        .with(oauthUser("regular-user@example.com")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("Forbidden.")))
                .andExpect(jsonPath("$.errors[0]", is("Admin role is required.")));
    }

    @Test
    void vocabularyCrudStillWorksForAuthenticatedUser() throws Exception {
        String email = "crud-user@example.com";

        MvcResult createResult = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "focus",
                                "vie", "tap trung",
                                "pos", "v",
                                "tag", "study"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("focus")))
                .andExpect(jsonPath("$.vie", is("tap trung")))
                .andReturn();

        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());
        long id = created.get("id").asLong();

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id", is((int) id)))
                .andExpect(jsonPath("$[0].eng", is("focus")));

        mockMvc.perform(put("/api/vocab/" + id)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "focus",
                                "vie", "tap trung cao do",
                                "pos", "v",
                                "tag", "study"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vie", is("tap trung cao do")));

        mockMvc.perform(delete("/api/vocab/" + id)
                        .with(oauthUser(email)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(0)));
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor oauthUser(String email) {
        return oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Test User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
    }
}
