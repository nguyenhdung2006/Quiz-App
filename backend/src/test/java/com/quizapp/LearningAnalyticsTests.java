package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
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
class LearningAnalyticsTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    @Test
    void analyticsEndpointsAggregateLearningDataAndInsights() throws Exception {
        String email = "analytics-user@example.com";
        long negotiateId = createWord(email, "negotiate", "dam phan", "business", "B2", 1, 4, 5, false, null);
        createWord(email, "contract", "hop dong", "business", "B2", 5, 0, 5, true, null);
        createWord(email, "invoice", "hoa don", "business", "B1", 1, 2, 3, false, Instant.now().minusSeconds(86400));

        var issued = mockMvc.perform(post("/api/quiz/attempts")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "quizMode", "vie",
                                "items", List.of(Map.of("wordId", negotiateId, "questionMode", "vie"))
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String attemptId = objectMapper.readTree(issued.getResponse().getContentAsString()).path("attemptId").asText();
        mockMvc.perform(post("/api/quiz/attempts/" + attemptId + "/submit")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "answers", List.of(Map.of("ordinal", 0, "selectedAnswer", "wrong"))
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/analytics/overview")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalWords", is(3)))
                .andExpect(jsonPath("$.masteredWords", is(1)))
                .andExpect(jsonPath("$.strugglingWords", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.totalQuizSessions", is(1)))
                .andExpect(jsonPath("$.weeklyXp", is(3)))
                .andExpect(jsonPath("$.insights[*].message", hasItem(containsString("business"))))
                .andExpect(jsonPath("$.insights[*].message", hasItem(containsString("vie"))));

        mockMvc.perform(get("/api/analytics/accuracy-trend")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accuracy", is(0)))
                .andExpect(jsonPath("$[0].quizCount", is(1)));

        mockMvc.perform(get("/api/analytics/weak-words")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].word", is("negotiate")))
                .andExpect(jsonPath("$[0].wrongCount", greaterThanOrEqualTo(4)));

        mockMvc.perform(get("/api/analytics/review-pressure")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mastered", is(1)))
                .andExpect(jsonPath("$.overdue", is(1)));

        mockMvc.perform(get("/api/analytics/tag-performance")
                        .with(oauthUser(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags[0].name", is("business")))
                .andExpect(jsonPath("$.levels[0].reviewCount", greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.quizModes[0].name", is("vie")));
    }

    private long createWord(
            String email,
            String eng,
            String vie,
            String tag,
            String level,
            int correct,
            int wrong,
            int seen,
            boolean mastered,
            Instant nextReview
    ) throws Exception {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("seen", seen);
        stats.put("correct", correct);
        stats.put("wrong", wrong);
        stats.put("streak", mastered ? 5 : 0);
        stats.put("bestStreak", mastered ? 5 : 0);
        stats.put("masteryLevel", mastered ? 5 : 1);
        if (nextReview != null) {
            stats.put("nextReview", nextReview.toString());
        }

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("eng", eng);
        request.put("vie", vie);
        request.put("pos", "n");
        request.put("tag", tag);
        request.put("level", level);
        request.put("mastered", mastered);
        request.put("stats", stats);

        var result = mockMvc.perform(post("/api/vocab")
                        .with(oauthUser(email))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        long wordId = created.get("id").asLong();
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("""
                     UPDATE vocabulary
                     SET mastered = ?
                     WHERE id = ?
                     """)) {
            statement.setBoolean(1, mastered);
            statement.setLong(2, wordId);
            statement.executeUpdate();
        }

        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("""
                     UPDATE word_stats
                     SET seen = ?,
                         correct = ?,
                         wrong = ?,
                         current_streak = ?,
                         best_streak = ?,
                         mastery_level = ?,
                         next_review = ?
                     WHERE word_id = ?
                     """)) {
            statement.setInt(1, seen);
            statement.setInt(2, correct);
            statement.setInt(3, wrong);
            statement.setInt(4, mastered ? 5 : 0);
            statement.setInt(5, mastered ? 5 : 0);
            statement.setInt(6, mastered ? 5 : 1);
            if (nextReview == null) {
                statement.setObject(7, null);
            } else {
                statement.setObject(7, java.sql.Timestamp.from(nextReview));
            }
            statement.setLong(8, wordId);
            statement.executeUpdate();
        }
        return wordId;
    }

    private static RequestPostProcessor oauthUser(String email) {
        RequestPostProcessor oauthLogin = oauth2Login().attributes(attributes -> {
            attributes.put("email", email);
            attributes.put("sub", "sub-" + email);
            attributes.put("name", "Analytics User");
            attributes.put("picture", "https://example.com/avatar.png");
        });
        return request -> csrf().postProcessRequest(oauthLogin.postProcessRequest(request));
    }
}
