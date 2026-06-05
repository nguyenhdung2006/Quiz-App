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
public class OpenAiDeckGeneratorClient implements AiDeckGeneratorClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String responsesUrl;

    public OpenAiDeckGeneratorClient(
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
    public List<GeneratedDeckWordDto> generate(GenerateDeckRequest request) {
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
                throw new IllegalStateException("OpenAI deck request failed with status " + response.statusCode() + ".");
            }

            return parseResponse(response.body());
        } catch (IOException exception) {
            throw new IllegalStateException("OpenAI deck response could not be processed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenAI deck request was interrupted.", exception);
        }
    }

    private ObjectNode buildRequest(GenerateDeckRequest request) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);

        ArrayNode input = root.putArray("input");
        input.add(message("developer", """
                You are a Vietnamese vocabulary deck generator.
                Extract useful English vocabulary from learner-provided English text.
                Return only JSON matching the schema.
                Vietnamese meanings must be natural Vietnamese with full diacritics, for example:
                "bài tập được giao", "sự có mặt", "hạn chót", "kiên cường".
                Never remove Vietnamese tone marks or write Vietnamese without accents.
                Do not include more than 20 items. Do not mention API details or unavailable data.
                """));
        input.add(message("user", "English text:\n" + safe(request.text())));

        ObjectNode text = root.putObject("text");
        ObjectNode format = text.putObject("format");
        format.put("type", "json_schema");
        format.put("name", "generated_vocabulary_deck");
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
        ObjectNode items = properties.putObject("items");
        items.put("type", "array");
        ObjectNode item = items.putObject("items");
        item.put("type", "object");
        item.put("additionalProperties", false);

        ObjectNode itemProperties = item.putObject("properties");
        addStringProperty(itemProperties, "english");
        addStringProperty(itemProperties, "vietnameseMeaning");
        addStringProperty(itemProperties, "partOfSpeech");
        addStringProperty(itemProperties, "level");
        addStringProperty(itemProperties, "exampleSentence");
        addStringProperty(itemProperties, "tag");

        ArrayNode itemRequired = item.putArray("required");
        itemRequired.add("english");
        itemRequired.add("vietnameseMeaning");
        itemRequired.add("partOfSpeech");
        itemRequired.add("level");
        itemRequired.add("exampleSentence");
        itemRequired.add("tag");

        ArrayNode required = schema.putArray("required");
        required.add("items");
        return schema;
    }

    private void addStringProperty(ObjectNode properties, String name) {
        ObjectNode property = properties.putObject(name);
        property.put("type", "string");
    }

    private List<GeneratedDeckWordDto> parseResponse(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        String outputText = outputText(root);
        if (outputText.isBlank()) {
            throw new IllegalStateException("OpenAI deck response did not include text output.");
        }

        JsonNode json = objectMapper.readTree(outputText);
        List<GeneratedDeckWordDto> items = new ArrayList<>();
        for (JsonNode item : json.path("items")) {
            String english = text(item, "english", "");
            String vietnameseMeaning = text(item, "vietnameseMeaning", "");
            if (english.isBlank() || vietnameseMeaning.isBlank()) continue;
            items.add(new GeneratedDeckWordDto(
                    english,
                    vietnameseMeaning,
                    text(item, "partOfSpeech", "n"),
                    text(item, "level", "A2"),
                    text(item, "exampleSentence", ""),
                    text(item, "tag", "ai-deck"),
                    "openai"
            ));
        }
        return items.stream().limit(20).toList();
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

    private String text(JsonNode node, String field, String fallback) {
        String value = node.path(field).asText("");
        return value.isBlank() ? safe(fallback) : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
