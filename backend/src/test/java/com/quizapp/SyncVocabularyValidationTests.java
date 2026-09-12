package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.vocab.VocabularyConstraints;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class SyncVocabularyValidationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void acceptsEveryVocabularyStringAtItsDocumentedBoundary() throws Exception {
        Map<String, Object> word = validWord();
        word.put("eng", "e".repeat(VocabularyConstraints.WORD_MAX));
        word.put("vie", "v".repeat(VocabularyConstraints.MEANING_MAX));
        word.put("pos", "p".repeat(VocabularyConstraints.POS_MAX));
        word.put("tag", "t".repeat(VocabularyConstraints.TAG_MAX));
        word.put("ipa", "i".repeat(VocabularyConstraints.IPA_MAX));
        word.put("level", "l".repeat(VocabularyConstraints.LEVEL_MAX));
        for (String field : List.of("context", "example", "exampleMeaning", "collocation",
                "synonyms", "antonyms", "commonMistake", "note")) {
            word.put(field, "d".repeat(VocabularyConstraints.DETAIL_MAX));
        }

        postSync("validation-boundary@example.com", "vocab", word)
                .andExpect(status().isOk());
    }

    @ParameterizedTest(name = "reports vocab item and field for {0}")
    @MethodSource("overLimitFields")
    void reportsExactInvalidVocabularyItemAndField(String field, int max) throws Exception {
        Map<String, Object> word = validWord();
        word.put(field, "x".repeat(max + 1));

        postSync("validation-" + field.toLowerCase() + "@example.com", "vocab", word)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed."))
                .andExpect(jsonPath("$.errors[0]", containsString("vocab[0]." + field + ":")))
                .andExpect(jsonPath("$.errors[0]", containsString(String.valueOf(max))));
    }

    @Test
    void validatesWrongBankItemsWithTheSameContract() throws Exception {
        Map<String, Object> word = validWord();
        word.put("note", "n".repeat(VocabularyConstraints.DETAIL_MAX + 1));

        postSync("validation-wrong-bank@example.com", "wrongWords", word)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]", containsString("wrongWords[0].note:")));
    }

    private static Stream<Arguments> overLimitFields() {
        return Stream.of(
                Arguments.of("eng", VocabularyConstraints.WORD_MAX),
                Arguments.of("vie", VocabularyConstraints.MEANING_MAX),
                Arguments.of("pos", VocabularyConstraints.POS_MAX),
                Arguments.of("tag", VocabularyConstraints.TAG_MAX),
                Arguments.of("ipa", VocabularyConstraints.IPA_MAX),
                Arguments.of("level", VocabularyConstraints.LEVEL_MAX),
                Arguments.of("context", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("example", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("exampleMeaning", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("collocation", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("synonyms", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("antonyms", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("commonMistake", VocabularyConstraints.DETAIL_MAX),
                Arguments.of("note", VocabularyConstraints.DETAIL_MAX)
        );
    }

    private Map<String, Object> validWord() {
        Map<String, Object> word = new LinkedHashMap<>();
        word.put("wordUid", UUID.randomUUID().toString());
        word.put("eng", "valid word");
        word.put("vie", "nghia hop le");
        word.put("pos", "n");
        return word;
    }

    private org.springframework.test.web.servlet.ResultActions postSync(
            String email,
            String collection,
            Map<String, Object> word
    ) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("syncContractVersion", 2);
        request.put("expectedRevision", 0);
        request.put("vocab", "vocab".equals(collection) ? List.of(word) : List.of());
        request.put("deletions", List.of());
        request.put("wrongWordDeletions", List.of());
        request.put("wrongWords", "wrongWords".equals(collection) ? List.of(word) : List.of());
        return mockMvc.perform(post("/api/sync")
                .with(oauthUser(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
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
