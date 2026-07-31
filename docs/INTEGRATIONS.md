# Integrations

## OpenAI

OpenAI is optional. The backend reads `OPENAI_API_KEY`; if it is absent, AI explanation and deck generation use rule-based fallbacks.

Operational behavior:

- AI provider failures are caught and converted to rule-based fallback responses.
- AI failures increment `wordarena.ai.failures`.
- AI requests are protected by the in-memory per-user limiter.
- Rate-limit hits return `429` with `retryAfterSeconds` and increment `wordarena.rate_limit.hits`.
- Logs must not include prompts, answers, vocabulary payloads, API keys, OAuth credentials, cookies, or CSRF tokens.

Configuration:

```text
OPENAI_API_KEY=
AI_MODEL=gpt-4.1-mini
RATE_LIMIT_MODE=in-memory
AI_EXPLAIN_RATE_LIMIT_PER_MINUTE=10
AI_EXPLAIN_RATE_LIMIT_PER_DAY=100
AI_DECK_RATE_LIMIT_PER_MINUTE=3
AI_DECK_RATE_LIMIT_PER_DAY=20
AI_RATE_LIMIT_MINUTE_WINDOW=60s
```

Distributed rate limiting is intentionally not implemented yet. Keep `RATE_LIMIT_MODE=in-memory` while the backend runs as one instance. Revisit Redis only after multi-instance deployment, material AI cost risk, or abuse evidence exists.
