package com.quizapp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class OpenAiExplanationClient implements AiExplanationClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String responsesUrl;

    public OpenAiExplanationClient(
            ObjectMapper objectMapper,
            @Value("${ai.openai.api-key:}") String apiKey,
            @Value("${ai.model:gpt-4.1-mini}") String model,
            @Value("${ai.openai.responses-url:https://api.openai.com/v1/responses}") String responsesUrl
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gpt-4.1-mini" : model.trim();
        this.responsesUrl = responsesUrl;
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    @Override
    public ExplainWrongAnswerResponse explain(ExplainWrongAnswerRequest request) {
        if (!isConfigured()) {
            throw new IllegalStateException("OpenAI API key is not configured.");
        }

        try {
            String payload = objectMapper.writeValueAsString(buildRequest(request));
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(responsesUrl))
                    .timeout(Duration.ofSeconds(25))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("OpenAI request failed with status " + response.statusCode() + ".");
            }

            return parseResponse(response.body(), request.word());
        } catch (IOException exception) {
            throw new IllegalStateException("OpenAI response could not be processed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenAI request was interrupted.", exception);
        }
    }

    private ObjectNode buildRequest(ExplainWrongAnswerRequest request) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);

        ArrayNode input = root.putArray("input");
        input.add(message("developer", """
                You are a Vietnamese vocabulary tutor. Explain wrong quiz answers in Vietnamese.
                Keep English examples natural and short. Return only JSON matching the schema.
                Do not mention internal policy, API details, or unavailable data.
                """));
        input.add(message("user", """
                Word: %s
                User answer: %s
                Correct answer: %s
                Question mode: %s
                Tag: %s
                CEFR level: %s
                Example: %s
                Note: %s
                """.formatted(
                safe(request.word()),
                safe(request.userAnswer()),
                safe(request.correctAnswer()),
                safe(request.questionMode()),
                safe(request.tag()),
                safe(request.level()),
                safe(request.example()),
                safe(request.note())
        )));

        ObjectNode text = root.putObject("text");
        ObjectNode format = text.putObject("format");
        format.put("type", "json_schema");
        format.put("name", "wrong_answer_explanation");
        format.put("strict", true);
        format.set("schema", responseSchema());

        return root;
    }

    private ObjectNode message(String role, String text) {
        ObjectNode message = objectMapper.createObjectNode();
        message.put("role", role);
        ArrayNode content = message.putArray("content");
        ObjectNode item = content.addObject();
        item.put("type", "input_text");
        item.put("text", text);
        return message;
    }

    private ObjectNode responseSchema() {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        schema.put("additionalProperties", false);

        ObjectNode properties = schema.putObject("properties");
        addStringProperty(properties, "word");
        addStringProperty(properties, "shortMeaning");
        addStringProperty(properties, "whyWrong");
        addStringProperty(properties, "correctUsage");
        addStringProperty(properties, "example");
        addStringProperty(properties, "memoryTip");
        addStringArrayProperty(properties, "collocations");
        addStringProperty(properties, "commonMistake");

        ArrayNode required = schema.putArray("required");
        required.add("word");
        required.add("shortMeaning");
        required.add("whyWrong");
        required.add("correctUsage");
        required.add("example");
        required.add("memoryTip");
        required.add("collocations");
        required.add("commonMistake");
        return schema;
    }

    private void addStringProperty(ObjectNode properties, String name) {
        ObjectNode property = properties.putObject(name);
        property.put("type", "string");
    }

    private void addStringArrayProperty(ObjectNode properties, String name) {
        ObjectNode property = properties.putObject(name);
        property.put("type", "array");
        ObjectNode items = property.putObject("items");
        items.put("type", "string");
    }

    private ExplainWrongAnswerResponse parseResponse(String body, String fallbackWord) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        String outputText = outputText(root);
        if (outputText.isBlank()) {
            throw new IllegalStateException("OpenAI response did not include text output.");
        }

        JsonNode json = objectMapper.readTree(outputText);
        return new ExplainWrongAnswerResponse(
                text(json, "word", fallbackWord),
                text(json, "shortMeaning", ""),
                text(json, "whyWrong", ""),
                text(json, "correctUsage", ""),
                text(json, "example", ""),
                text(json, "memoryTip", ""),
                stringList(json.get("collocations")),
                text(json, "commonMistake", ""),
                "openai"
        );
    }

    private String outputText(JsonNode root) {
        String direct = root.path("output_text").asText("");
        if (!direct.isBlank()) {
            return direct;
        }

        StringBuilder combined = new StringBuilder();
        for (JsonNode output : root.path("output")) {
            for (JsonNode content : output.path("content")) {
                String text = content.path("text").asText("");
                if (!text.isBlank()) {
                    combined.append(text);
                }
            }
        }
        return combined.toString();
    }

    private List<String> stringList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node != null && node.isArray()) {
            for (JsonNode item : node) {
                if (!item.asText("").isBlank()) {
                    values.add(item.asText());
                }
            }
        }
        return values;
    }

    private String text(JsonNode node, String field, String fallback) {
        String value = node.path(field).asText("");
        return value.isBlank() ? safe(fallback) : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
