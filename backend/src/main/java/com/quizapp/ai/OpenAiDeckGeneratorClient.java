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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class OpenAiDeckGeneratorClient implements AiDeckGeneratorClient {
    private static final Logger log = LoggerFactory.getLogger(OpenAiDeckGeneratorClient.class);
    private static final Set<String> VALID_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final int MAX_ENGLISH_LENGTH = 80;
    private static final int MAX_MEANING_LENGTH = 160;
    private static final int MAX_POS_LENGTH = 20;
    private static final int MAX_EXAMPLE_LENGTH = 240;
    private static final int MAX_TAG_LENGTH = 40;

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
            log.warn("[AI] OpenAI deck client not configured");
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
                log.warn("[AI] OpenAI deck API error status={}", response.statusCode());
                throw new IllegalStateException("OpenAI deck request failed with status " + response.statusCode() + ".");
            }

            List<GeneratedDeckWordDto> result = parseResponse(response.body(), request);
            log.info("[AI] OpenAI deck API success itemsCount={}", result.size());
            return result;
        } catch (IOException exception) {
            log.error("[AI] OpenAI deck IO error", exception);
            throw new IllegalStateException("OpenAI deck response could not be processed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("[AI] OpenAI deck interrupted", exception);
            throw new IllegalStateException("OpenAI deck request was interrupted.", exception);
        }
    }

    private ObjectNode buildRequest(GenerateDeckRequest request) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);

        String targetLevel = request.normalizedTargetLevel();
        int maxWords = request.normalizedMaxWords();

        ArrayNode input = root.putArray("input");
        input.add(message("developer", """
                You are a Vietnamese vocabulary deck generator.
                Extract useful English vocabulary from learner-provided English text.
                Return only JSON matching the schema.
                CEFR target: %s.
                Maximum items: %d.
                If CEFR target is Any, extract useful vocabulary across levels.
                If CEFR target is A1, A2, B1, B2, C1, or C2, include only words that accurately match that level.
                If the pasted text has no suitable words for the selected CEFR level, return {"items":[]}.
                Use only words or useful phrases that actually appear in the source text.
                Do not invent words, meanings, examples, tags, or levels.
                Deduplicate by English word or phrase.
                Preserve a source sentence from the pasted text in exampleSentence when possible.
                Infer partOfSpeech and tag from the source context.
                level must be one of A1, A2, B1, B2, C1, or C2.
                Vietnamese meanings must be natural Vietnamese with full diacritics, for example:
                "bài tập được giao", "sự có mặt", "hạn chót", "kiên cường".
                Never remove Vietnamese tone marks or write Vietnamese without accents.
                Never return placeholder meanings such as unknown, N/A, or "cần bổ sung nghĩa".
                Do not mention API details or unavailable data.
                """.formatted(targetLevel, maxWords)));
        input.add(message("user", "Target CEFR level: " + targetLevel + "\nEnglish text:\n" + safe(request.text())));

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

    private List<GeneratedDeckWordDto> parseResponse(String body, GenerateDeckRequest request) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        String outputText = outputText(root);
        if (outputText.isBlank()) {
            throw new IllegalStateException("OpenAI deck response did not include text output.");
        }

        JsonNode json = AiJsonGuardrails.parseJsonOutput(objectMapper, outputText);
        JsonNode rawItems = json.isArray() ? json : json.path("items");
        List<GeneratedDeckWordDto> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String targetLevel = request.normalizedTargetLevel();
        for (JsonNode item : rawItems) {
            String english = boundedText(item, MAX_ENGLISH_LENGTH, "english", "eng", "word", "term");
            String vietnameseMeaning = boundedText(item, MAX_MEANING_LENGTH, "vietnameseMeaning", "vietnamese", "vie", "meaning");
            String level = normalizeLevel(firstText(item, "level", "cefr", "wordLevel"), targetLevel);
            String key = normalizedEnglishKey(english);
            if (english.isBlank() || !hasUsableVietnameseMeaning(vietnameseMeaning) || key.isBlank() || seen.contains(key)) continue;
            if (request.hasSpecificTargetLevel() && !targetLevel.equals(level)) continue;
            seen.add(key);
            items.add(new GeneratedDeckWordDto(
                    english,
                    vietnameseMeaning,
                    normalizePartOfSpeech(firstText(item, "partOfSpeech", "pos", "part_of_speech")),
                    level,
                    boundedText(item, MAX_EXAMPLE_LENGTH, "exampleSentence", "example", "sentence"),
                    normalizeTag(firstText(item, "tag", "topic", "category")),
                    "openai"
            ));
        }
        return items.stream().limit(request.normalizedMaxWords()).toList();
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

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = node.path(field).asText("");
            if (!value.isBlank()) {
                return compact(value);
            }
        }
        return "";
    }

    private String boundedText(JsonNode node, int maxLength, String... fields) {
        String value = firstText(node, fields);
        if (value.length() > maxLength) {
            return "";
        }
        return value;
    }

    private String normalizeLevel(String value, String fallback) {
        String level = compact(value).toUpperCase(Locale.ROOT);
        if (VALID_LEVELS.contains(level)) {
            return level;
        }
        return "Any".equals(fallback) ? "A2" : fallback;
    }

    private String normalizePartOfSpeech(String value) {
        String pos = compact(value).toLowerCase(Locale.ROOT);
        return switch (pos) {
            case "noun", "n" -> "n";
            case "verb", "v" -> "v";
            case "adjective", "adj" -> "adj";
            case "adverb", "adv" -> "adv";
            case "conjunction", "conj" -> "conj";
            case "preposition", "prep" -> "prep";
            case "idiom" -> "idiom";
            case "phrase" -> "phrase";
            default -> pos.length() <= MAX_POS_LENGTH && !pos.isBlank() ? pos : "n";
        };
    }

    private String normalizeTag(String value) {
        String tag = compact(value).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        tag = tag.replaceAll("(^-+|-+$)", "");
        return tag.isBlank() || tag.length() > MAX_TAG_LENGTH ? "general" : tag;
    }

    private String normalizedEnglishKey(String value) {
        return compact(value).toLowerCase(Locale.ROOT);
    }

    private boolean hasUsableVietnameseMeaning(String value) {
        String meaning = compact(value);
        if (meaning.isBlank()) {
            return false;
        }
        String lower = meaning.toLowerCase(Locale.ROOT);
        return !lower.contains("cần bổ sung")
                && !lower.contains("unknown")
                && !lower.contains("placeholder")
                && !lower.equals("n/a")
                && !lower.equals("na");
    }

    private String compact(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String safe(String value) {
        return compact(value);
    }
}
