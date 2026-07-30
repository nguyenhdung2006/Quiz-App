package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class SyncContractV2Tests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void directCrudCreatesReturnsAndPreservesStableWordUid() throws Exception {
        String email = "stable-crud@example.com";
        String wordUid = UUID.randomUUID().toString();

        MvcResult createResult = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wordJson(wordUid, "focus", "tap trung")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wordUid", is(wordUid)))
                .andReturn();

        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());
        long id = created.path("id").asLong();

        mockMvc.perform(put("/api/vocab/" + id)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wordJson(wordUid, "deep focus", "tap trung sau")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wordUid", is(wordUid)))
                .andExpect(jsonPath("$.eng", is("deep focus")));

        mockMvc.perform(put("/api/vocab/" + id)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wordJson(UUID.randomUUID().toString(), "deep focus", "tap trung sau")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void syncRequiresContractVersionTwoAndWordUid() throws Exception {
        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("sync-upgrade@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "expectedRevision": 0,
                                  "vocab": []
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("SYNC_CLIENT_UPGRADE_REQUIRED")))
                .andExpect(jsonPath("$.requiredSyncContractVersion", is(2)));

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser("sync-worduid-required@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "syncContractVersion": 2,
                                  "expectedRevision": 0,
                                  "vocab": [
                                    {
                                      "eng": "missing uid",
                                      "vie": "thieu uid"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("wordUid is required for sync vocabulary items.")));
    }

    @Test
    void syncV2RenamesByWordUidInsteadOfEnglish() throws Exception {
        String email = "uid-rename@example.com";
        String wordUid = UUID.randomUUID().toString();

        postSync(email, 0, List.of(wordMap(wordUid, "old name", "nghia cu")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)));

        postSync(email, 1, List.of(wordMap(wordUid, "new name", "nghia moi")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(2)))
                .andExpect(jsonPath("$.vocab.length()", is(1)))
                .andExpect(jsonPath("$.vocab[0].wordUid", is(wordUid)))
                .andExpect(jsonPath("$.vocab[0].eng", is("new name")));
    }

    @Test
    void tombstoneWinsOverLiveRecordAndRepeatedDeletionDoesNotIncrementRevision() throws Exception {
        String email = "tombstone-wins@example.com";
        String wordUid = UUID.randomUUID().toString();

        postSync(email, 0, List.of(wordMap(wordUid, "archive", "luu tru")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)));

        postSync(email, 1, List.of(), List.of(Map.of("wordUid", wordUid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(2)))
                .andExpect(jsonPath("$.vocab.length()", is(0)))
                .andExpect(jsonPath("$.tombstones.length()", is(1)))
                .andExpect(jsonPath("$.tombstones[0].wordUid", is(wordUid)))
                .andExpect(jsonPath("$.tombstones[0].deletedRevision", is(2)));

        postSync(email, 2, List.of(), List.of(Map.of("wordUid", wordUid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(2)))
                .andExpect(jsonPath("$.tombstones.length()", is(1)));

        postSync(email, 1, List.of(wordMap(wordUid, "stale archive", "cu")), List.of())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("SYNC_REVISION_CONFLICT")))
                .andExpect(jsonPath("$.currentRevision", is(2)));

        postSync(email, 2, List.of(wordMap(wordUid, "stale archive", "cu")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(2)))
                .andExpect(jsonPath("$.vocab.length()", is(0)))
                .andExpect(jsonPath("$.tombstones.length()", is(1)));
    }

    @Test
    void directDeleteCreatesTombstoneAndHardDeletesLiveWord() throws Exception {
        String email = "direct-tombstone@example.com";
        String wordUid = UUID.randomUUID().toString();

        MvcResult createResult = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wordJson(wordUid, "remove me", "xoa toi")))
                .andExpect(status().isOk())
                .andReturn();
        long id = objectMapper.readTree(createResult.getResponse().getContentAsString()).path("id").asLong();

        mockMvc.perform(delete("/api/vocab/" + id).with(oauthUser(email)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/snapshot").with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vocab.length()", is(0)))
                .andExpect(jsonPath("$.tombstones.length()", is(1)))
                .andExpect(jsonPath("$.tombstones[0].wordUid", is(wordUid)));
    }

    @Test
    void duplicateEnglishAcrossDifferentUidsRollsBackAtomically() throws Exception {
        String email = "atomic-duplicate@example.com";
        String wordUid = UUID.randomUUID().toString();

        postSync(email, 0, List.of(wordMap(wordUid, "alpha", "mot")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)));

        postSync(email, 1, List.of(wordMap(UUID.randomUUID().toString(), "alpha", "hai")), List.of())
                .andExpect(status().isBadRequest());

        MvcResult snapshotResult = mockMvc.perform(get("/api/snapshot").with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)))
                .andReturn();

        JsonNode snapshot = objectMapper.readTree(snapshotResult.getResponse().getContentAsString());
        assertThat(snapshot.path("vocab").path(0).path("wordUid").asText()).isEqualTo(wordUid);
        assertThat(snapshot.path("vocab").path(0).path("eng").asText()).isEqualTo("alpha");
    }

    @Test
    void sameWordUidIsIsolatedPerUser() throws Exception {
        String sharedUid = UUID.randomUUID().toString();

        postSync("owner-a@example.com", 0, List.of(wordMap(sharedUid, "shared a", "a")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)));
        postSync("owner-a@example.com", 1, List.of(), List.of(Map.of("wordUid", sharedUid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(2)));

        postSync("owner-b@example.com", 0, List.of(wordMap(sharedUid, "shared b", "b")), List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(1)))
                .andExpect(jsonPath("$.vocab.length()", is(1)))
                .andExpect(jsonPath("$.tombstones.length()", is(0)));
    }

    private org.springframework.test.web.servlet.ResultActions postSync(
            String email,
            long expectedRevision,
            List<Map<String, Object>> vocab,
            List<Map<String, String>> deletions
    ) throws Exception {
        return mockMvc.perform(post("/api/sync")
                .with(oauthUser(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "syncContractVersion", 2,
                        "expectedRevision", expectedRevision,
                        "vocab", vocab,
                        "deletions", deletions,
                        "wrongWords", List.of()
                ))));
    }

    private Map<String, Object> wordMap(String wordUid, String eng, String vie) {
        return Map.of(
                "wordUid", wordUid,
                "eng", eng,
                "vie", vie,
                "pos", "n"
        );
    }

    private String wordJson(String wordUid, String eng, String vie) throws Exception {
        return objectMapper.writeValueAsString(wordMap(wordUid, eng, vie));
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
