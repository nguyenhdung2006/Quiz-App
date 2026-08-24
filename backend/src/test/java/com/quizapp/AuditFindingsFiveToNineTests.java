package com.quizapp;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
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
class AuditFindingsFiveToNineTests {
    private static final String REVISION_HEADER = "X-Sync-Revision";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void mutationResponsesAdvanceRevisionWithoutWeakeningRealConflictProtection() throws Exception {
        String email = "audit-revision-propagation@example.com";
        JsonNode created = createWord(email, "revision intent", "y dinh revision", "00000000-0000-4000-8000-000000000701", 1);
        long wordId = created.path("id").asLong();

        mockMvc.perform(put("/api/vocab/{id}", wordId)
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wordBody("revision intent updated", "y dinh revision", created.path("wordUid").asText())))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, "2"));

        mockMvc.perform(post("/api/review/answer")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "wordId", wordId,
                                "correct", false,
                                "mode", "mark-hard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, "3"))
                .andExpect(jsonPath("$.word.stats.wrong", is(1)));

        JsonNode snapshot = snapshot(email);
        org.assertj.core.api.Assertions.assertThat(snapshot.path("vocab").path(0).path("stats").path("wrong").asInt())
                .isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(snapshot.path("wrongWords")).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(snapshot.path("wrongWords").path(0).path("mastered").asBoolean())
                .isFalse();
        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(syncBody(3, snapshot.path("vocab"), new String[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(3)));

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(syncBody(2, snapshot.path("vocab"), new String[0])))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("SYNC_REVISION_CONFLICT")))
                .andExpect(jsonPath("$.currentRevision", is(3)));

        mockMvc.perform(delete("/api/vocab/{id}", wordId).with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, "4"));
    }

    @Test
    void markKnownUsesDedicatedServerMinimumWithoutAwardingXpOrQuizHistory() throws Exception {
        String email = "audit-mark-known@example.com";
        JsonNode created = createWord(email, "already known", "da biet", "00000000-0000-4000-8000-000000000702", 1);
        JsonNode beforeMarkKnown = snapshot(email);

        mockMvc.perform(post("/api/review/known")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("wordId", created.path("id").asLong()))))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, "2"))
                .andExpect(jsonPath("$.streak", is(2)))
                .andExpect(jsonPath("$.mastery", is(60)))
                .andExpect(jsonPath("$.word.stats.seen", is(1)))
                .andExpect(jsonPath("$.word.stats.correct", is(1)))
                .andExpect(jsonPath("$.word.stats.masteryLevel", is(3)))
                .andExpect(jsonPath("$.word.mastered", is(false)));

        JsonNode afterMarkKnown = snapshot(email);
        org.assertj.core.api.Assertions.assertThat(afterMarkKnown.path("revision").asLong()).isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(afterMarkKnown.path("profile").path("xp").asInt())
                .isEqualTo(beforeMarkKnown.path("profile").path("xp").asInt());
        org.assertj.core.api.Assertions.assertThat(afterMarkKnown.path("quizHistory").size())
                .isEqualTo(beforeMarkKnown.path("quizHistory").size());
        org.assertj.core.api.Assertions.assertThat(afterMarkKnown.path("vocab").path(0).path("stats").path("streak").asInt())
                .isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(afterMarkKnown.path("vocab").path(0).path("stats").path("masteryLevel").asInt())
                .isEqualTo(3);

        mockMvc.perform(post("/api/review/known")
                        .with(oauthUser("audit-mark-known-attacker@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("wordId", created.path("id").asLong()))))
                .andExpect(status().isBadRequest());

        JsonNode afterUnauthorizedAttempt = snapshot(email);
        org.assertj.core.api.Assertions.assertThat(afterUnauthorizedAttempt.path("revision").asLong()).isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(afterUnauthorizedAttempt.path("vocab").path(0).path("stats").path("streak").asInt())
                .isEqualTo(2);
    }

    @Test
    void clearMasteredWrongBankPersistsAndLeavesUnrelatedEntriesProtected() throws Exception {
        String email = "audit-wrong-bank@example.com";
        JsonNode primary = createWord(email, "master target", "muc tieu", "00000000-0000-4000-8000-000000000703", 1);
        JsonNode unrelated = createWord(email, "keep mistake", "giu loi", "00000000-0000-4000-8000-000000000704", 2);

        review(email, primary.path("id").asLong(), false, 3);
        review(email, unrelated.path("id").asLong(), false, 4);
        markKnown(email, primary.path("id").asLong(), 5);
        review(email, primary.path("id").asLong(), true, 6);
        review(email, primary.path("id").asLong(), true, 7);
        review(email, primary.path("id").asLong(), true, 8);

        JsonNode beforeClear = snapshot(email);
        org.assertj.core.api.Assertions.assertThat(beforeClear.path("wrongWords")).hasSize(2);
        org.assertj.core.api.Assertions.assertThat(findWord(beforeClear.path("vocab"), primary.path("wordUid").asText())
                .path("mastered").asBoolean()).isTrue();

        MvcResult cleared = mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(syncBody(8, beforeClear.path("vocab"), new String[]{
                                primary.path("wordUid").asText(),
                                unrelated.path("wordUid").asText()
                        })))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, "9"))
                .andExpect(jsonPath("$.revision", is(9)))
                .andExpect(jsonPath("$.wrongWords", hasSize(1)))
                .andExpect(jsonPath("$.wrongWords[0].eng", is("keep mistake")))
                .andReturn();

        JsonNode afterClear = objectMapper.readTree(cleared.getResponse().getContentAsString());
        JsonNode pulledAfterClear = snapshot(email);
        org.assertj.core.api.Assertions.assertThat(pulledAfterClear.path("wrongWords")).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(pulledAfterClear.path("wrongWords").path(0).path("eng").asText())
                .isEqualTo("keep mistake");
        org.assertj.core.api.Assertions.assertThat(pulledAfterClear.path("vocab")).hasSize(2);
        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(syncBody(9, afterClear.path("vocab"), new String[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision", is(9)))
                .andExpect(jsonPath("$.wrongWords", hasSize(1)))
                .andExpect(jsonPath("$.wrongWords[0].eng", is("keep mistake")));

        mockMvc.perform(post("/api/sync")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(syncBody(8, afterClear.path("vocab"), new String[]{unrelated.path("wordUid").asText()})))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("SYNC_REVISION_CONFLICT")))
                .andExpect(jsonPath("$.currentRevision", is(9)));
    }

    private JsonNode createWord(String email, String eng, String vie, String wordUid, long expectedRevision) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wordBody(eng, vie, wordUid)))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, String.valueOf(expectedRevision)))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void review(String email, long wordId, boolean correct, long expectedRevision) throws Exception {
        mockMvc.perform(post("/api/review/answer")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "wordId", wordId,
                                "correct", correct,
                                "mode", "review"
                        ))))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, String.valueOf(expectedRevision)));
    }

    private void markKnown(String email, long wordId, long expectedRevision) throws Exception {
        mockMvc.perform(post("/api/review/known")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("wordId", wordId))))
                .andExpect(status().isOk())
                .andExpect(header().string(REVISION_HEADER, String.valueOf(expectedRevision)));
    }

    private JsonNode snapshot(String email) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/snapshot").with(oauthUser(email)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode findWord(JsonNode words, String wordUid) {
        for (JsonNode word : words) {
            if (wordUid.equals(word.path("wordUid").asText())) return word;
        }
        return objectMapper.createObjectNode();
    }

    private String wordBody(String eng, String vie, String wordUid) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "wordUid", wordUid,
                "eng", eng,
                "vie", vie,
                "pos", "n",
                "tag", "audit",
                "level", "B1"
        ));
    }

    private String syncBody(long expectedRevision, JsonNode vocab, String[] wrongWordDeletions) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("syncContractVersion", 2);
        body.put("expectedRevision", expectedRevision);
        body.set("vocab", vocab.deepCopy());
        body.set("deletions", objectMapper.createArrayNode());
        body.set("wrongWords", objectMapper.createArrayNode());
        ArrayNode wrongDeletes = body.putArray("wrongWordDeletions");
        for (String wordUid : wrongWordDeletions) {
            wrongDeletes.addObject().put("wordUid", wordUid);
        }
        return objectMapper.writeValueAsString(body);
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor login = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Audit User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(login.postProcessRequest(request));
    }
}
