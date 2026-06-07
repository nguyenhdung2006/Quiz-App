package com.quizapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.ai.AiDeckGeneratorClient;
import com.quizapp.ai.AiDeckGeneratorService;
import com.quizapp.ai.AiExplanationClient;
import com.quizapp.ai.AiExplanationService;
import com.quizapp.ai.ExplainWrongAnswerRequest;
import com.quizapp.ai.ExplainWrongAnswerResponse;
import com.quizapp.ai.GenerateDeckRequest;
import com.quizapp.ai.GeneratedDeckResponse;
import com.quizapp.ai.GeneratedDeckWordDto;
import com.quizapp.ai.OpenAiDeckGeneratorClient;
import com.quizapp.ai.OpenAiExplanationClient;
import com.quizapp.ai.RuleBasedDeckGeneratorService;
import com.quizapp.ai.RuleBasedExplanationService;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OpenAiClientGuardrailTests {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void deckClientAcceptsMarkdownJsonAndFiltersInvalidDuplicateRows() throws Exception {
        String output = """
                ```json
                {
                  "items": [
                    {
                      "english": " Invoice ",
                      "vietnameseMeaning": " hoa don ",
                      "partOfSpeech": "NOUN",
                      "level": "B1",
                      "exampleSentence": "Please send the invoice today.",
                      "tag": "Business Email"
                    },
                    {
                      "eng": "invoice",
                      "vie": "hoa don khac",
                      "pos": "n",
                      "cefr": "B1",
                      "example": "Duplicate invoice.",
                      "tag": "business"
                    },
                    {
                      "english": "deadline",
                      "vietnamese": "han chot",
                      "pos": "verb",
                      "cefr": "B1",
                      "example": "The deadline is Friday.",
                      "tag": "work"
                    },
                    {
                      "english": "",
                      "vietnameseMeaning": "blank english",
                      "level": "B1"
                    },
                    {
                      "english": "This generated item is intentionally far too long to be treated as a vocabulary word because it is a sentence.",
                      "vietnameseMeaning": "qua dai",
                      "level": "B1"
                    }
                  ]
                }
                ```
                """;

        try (StubOpenAiServer server = StubOpenAiServer.output(objectMapper, output)) {
            OpenAiDeckGeneratorClient client = new OpenAiDeckGeneratorClient(
                    objectMapper,
                    "test-key",
                    "test-model",
                    server.url()
            );

            List<GeneratedDeckWordDto> items = client.generate(new GenerateDeckRequest(
                    "Please send the invoice before the deadline.",
                    "B1",
                    10
            ));

            assertThat(items).hasSize(2);
            assertThat(items.get(0).english()).isEqualTo("Invoice");
            assertThat(items.get(0).partOfSpeech()).isEqualTo("n");
            assertThat(items.get(0).tag()).isEqualTo("business-email");
            assertThat(items.get(1).english()).isEqualTo("deadline");
            assertThat(items.get(1).partOfSpeech()).isEqualTo("v");
        }
    }

    @Test
    void deckClientAcceptsTopLevelArrayOutput() throws Exception {
        String output = """
                [
                  {
                    "word": "attendance",
                    "meaning": "su co mat",
                    "part_of_speech": "noun",
                    "wordLevel": "A2",
                    "sentence": "Attendance is important.",
                    "category": "school"
                  }
                ]
                """;

        try (StubOpenAiServer server = StubOpenAiServer.output(objectMapper, output)) {
            OpenAiDeckGeneratorClient client = new OpenAiDeckGeneratorClient(
                    objectMapper,
                    "test-key",
                    "test-model",
                    server.url()
            );

            List<GeneratedDeckWordDto> items = client.generate(new GenerateDeckRequest(
                    "Attendance is important.",
                    "A2",
                    5
            ));

            assertThat(items).singleElement().satisfies(item -> {
                assertThat(item.english()).isEqualTo("attendance");
                assertThat(item.vietnameseMeaning()).isEqualTo("su co mat");
                assertThat(item.source()).isEqualTo("openai");
            });
        }
    }

    @Test
    void explanationClientAcceptsMarkdownJsonAndAliasFields() throws Exception {
        String output = """
                ```json
                {
                  "english": "negotiate",
                  "meaning": "dam phan",
                  "reason": "The selected answer does not match the context.",
                  "usage": "Use negotiate when people discuss terms.",
                  "exampleSentence": "They negotiate a fair price.",
                  "tip": "Connect negotiate with agreement.",
                  "collocations": "negotiate a deal",
                  "common_mistake": "Do not use it for a solo decision."
                }
                ```
                """;

        try (StubOpenAiServer server = StubOpenAiServer.output(objectMapper, output)) {
            OpenAiExplanationClient client = new OpenAiExplanationClient(
                    objectMapper,
                    "test-key",
                    "test-model",
                    server.url()
            );

            ExplainWrongAnswerResponse response = client.explain(validExplainRequest());

            assertThat(response.word()).isEqualTo("negotiate");
            assertThat(response.shortMeaning()).isEqualTo("dam phan");
            assertThat(response.whyWrong()).contains("selected answer");
            assertThat(response.collocations()).containsExactly("negotiate a deal");
            assertThat(response.source()).isEqualTo("openai");
        }
    }

    @Test
    void malformedDeckResponseFallsBackWithoutRawError() {
        AiDeckGeneratorClient brokenClient = new AiDeckGeneratorClient() {
            @Override
            public boolean isConfigured() {
                return true;
            }

            @Override
            public List<GeneratedDeckWordDto> generate(GenerateDeckRequest request) {
                throw new IllegalStateException("OpenAI deck response could not be processed.");
            }
        };
        AiDeckGeneratorService service = new AiDeckGeneratorService(brokenClient, new RuleBasedDeckGeneratorService());

        GeneratedDeckResponse response = service.generateDeck(new GenerateDeckRequest(
                "The assignment has a deadline and attendance is important.",
                "A2",
                10
        ));

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.items()).isNotEmpty();
    }

    @Test
    void emptyExplanationResponseFallsBackWithoutRawError() {
        AiExplanationClient brokenClient = new AiExplanationClient() {
            @Override
            public boolean isConfigured() {
                return true;
            }

            @Override
            public ExplainWrongAnswerResponse explain(ExplainWrongAnswerRequest request) {
                throw new IllegalStateException("OpenAI response did not include text output.");
            }
        };
        AiExplanationService service = new AiExplanationService(brokenClient, new RuleBasedExplanationService());

        ExplainWrongAnswerResponse response = service.explainWrongAnswer(validExplainRequest());

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.word()).isEqualTo("negotiate");
    }

    @Test
    void clientThrowsControlledExceptionForMalformedJson() throws Exception {
        try (StubOpenAiServer server = StubOpenAiServer.output(objectMapper, "{not-json")) {
            OpenAiDeckGeneratorClient client = new OpenAiDeckGeneratorClient(
                    objectMapper,
                    "test-key",
                    "test-model",
                    server.url()
            );

            assertThatThrownBy(() -> client.generate(new GenerateDeckRequest(
                    "Useful vocabulary appears here.",
                    "Any",
                    5
            ))).isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("could not be processed");
        }
    }

    private ExplainWrongAnswerRequest validExplainRequest() {
        return new ExplainWrongAnswerRequest(
                "negotiate",
                "trade",
                "discuss to reach an agreement",
                "eng",
                "business",
                "B2",
                "They negotiate a fair price.",
                "Business vocabulary."
        );
    }

    private record StubOpenAiServer(HttpServer server, String url) implements AutoCloseable {
        static StubOpenAiServer output(ObjectMapper objectMapper, String outputText) throws IOException {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            String body = objectMapper.writeValueAsString(Map.of("output_text", outputText));
            server.createContext("/", exchange -> {
                byte[] response = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
                exchange.sendResponseHeaders(200, response.length);
                exchange.getResponseBody().write(response);
                exchange.close();
            });
            server.start();
            return new StubOpenAiServer(server, "http://127.0.0.1:" + server.getAddress().getPort() + "/");
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
