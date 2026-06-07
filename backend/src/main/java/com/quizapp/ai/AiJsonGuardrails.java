package com.quizapp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;

final class AiJsonGuardrails {
    private AiJsonGuardrails() {
    }

    static JsonNode parseJsonOutput(ObjectMapper objectMapper, String rawOutput) throws IOException {
        String clean = stripMarkdownFence(rawOutput);
        if (clean.isBlank()) {
            throw new IOException("AI response text was empty.");
        }

        try {
            return objectMapper.readTree(clean);
        } catch (IOException firstFailure) {
            String candidate = extractJsonCandidate(clean);
            if (candidate.equals(clean)) {
                throw firstFailure;
            }
            return objectMapper.readTree(candidate);
        }
    }

    static String stripMarkdownFence(String value) {
        String clean = value == null ? "" : value.trim();
        if (!clean.startsWith("```")) {
            return clean;
        }

        int firstLineEnd = clean.indexOf('\n');
        if (firstLineEnd < 0) {
            return "";
        }

        String withoutOpeningFence = clean.substring(firstLineEnd + 1).trim();
        if (withoutOpeningFence.endsWith("```")) {
            withoutOpeningFence = withoutOpeningFence.substring(0, withoutOpeningFence.length() - 3);
        }
        return withoutOpeningFence.trim();
    }

    private static String extractJsonCandidate(String value) {
        int objectStart = value.indexOf('{');
        int arrayStart = value.indexOf('[');
        int start;
        char close;

        if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
            start = objectStart;
            close = '}';
        } else if (arrayStart >= 0) {
            start = arrayStart;
            close = ']';
        } else {
            return value;
        }

        int end = value.lastIndexOf(close);
        if (end <= start) {
            return value;
        }
        return value.substring(start, end + 1).trim();
    }
}
