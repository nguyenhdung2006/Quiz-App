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
    void createWordRejectsNormalizedEnglishDuplicate() throws Exception {
        String email = "duplicate-create@example.com";

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", " Hello   World ",
                                "vie", "xin chao the gioi",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("Hello World")));

        mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", "hello world",
                                "vie", "xin chao",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Word already exists.")));

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)));
    }

    @Test
    void updateWordRejectsNormalizedEnglishDuplicateButAllowsSameWord() throws Exception {
        String email = "duplicate-update@example.com";
        long helloId = createWord(email, "Hello", "xin chao");
        long focusId = createWord(email, "focus", "tap trung");

        mockMvc.perform(put("/api/vocab/" + helloId)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", " hello ",
                                "vie", "xin chao updated",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eng", is("hello")))
                .andExpect(jsonPath("$.vie", is("xin chao updated")));

        mockMvc.perform(put("/api/vocab/" + focusId)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eng", " HELLO ",
                                "vie", "xin chao duplicate",
                                "pos", "n",
                                "tag", "greeting"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Word already exists.")));
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
    void currentUserEndpointReturnsUnauthenticatedJsonWithoutRedirect() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated", is(false)));
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

    @Test
    void deleteVocabularyIsIdempotentAndDoesNotCrossUserBoundaries() throws Exception {
        String ownerEmail = "delete-owner@example.com";
        String otherEmail = "delete-other@example.com";
        long ownerWordId = createWord(ownerEmail, "archive", "luu tru");
        long otherWordId = createWord(otherEmail, "private", "rieng tu");

        mockMvc.perform(delete("/api/vocab/" + ownerWordId)
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/vocab/" + ownerWordId)
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/vocab/99999999")
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/vocab/" + otherWordId)
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(ownerEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(0)));

        mockMvc.perform(get("/api/vocab")
                        .with(oauthUser(otherEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)))
                .andExpect(jsonPath("$[0].id", is((int) otherWordId)))
                .andExpect(jsonPath("$[0].eng", is("private")));
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

        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        return created.get("id").asLong();
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
