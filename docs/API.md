# API Notes

This file is the canonical lightweight API inventory for the current Spring
controllers. It is not a generated OpenAPI spec; keep it aligned with
`backend/src/main/java/com/quizapp/**/*Controller.java` and
`backend/src/main/java/com/quizapp/config/SecurityConfig.java`.

Run the local drift check after changing controllers, migrations, env config, or
this document:

```powershell
npm run test:docs-drift
```

## Auth Model

The backend uses Google OAuth2 login and a server-side `JSESSIONID` session.

Public routes configured in `SecurityConfig`:

- `OPTIONS /**`
- `/oauth2/**`
- `/login/oauth2/**`
- `/api/health/**`
- `/api/csrf`
- `/api/me`
- `/actuator/health`
- `/actuator/info`
- `/error`

All other application and actuator routes require an authenticated Google
session. Unsafe authenticated requests also require CSRF.

Protected actuator metrics routes:

- `/actuator/metrics`
- `/actuator/metrics/**`

Unauthenticated `/api/me` returns `{ "authenticated": false }`; authenticated
`/api/me` returns the profile DTO.

## Error Contract

Common errors use:

```json
{
  "message": "Validation failed.",
  "errors": ["field: reason"]
}
```

Important status codes:

- `200`: normal JSON response, including direct deletes with an empty body.
- `400`: validation error, malformed JSON, invalid avatar, or Sync V2 upgrade required.
- `403`: invalid/missing CSRF token or authenticated user lacks required role.
- `409`: Sync V2 revision conflict, expired quiz attempt, or conflicting quiz-attempt replay.
- `410`: authenticated use of the retired legacy quiz-result mutation route.
- `413`: `/api/sync` body exceeded `app.sync.max-request-body-bytes`.
- `429`: AI per-user rate limit exceeded.
- `500`: unexpected server error.

## CSRF

### GET `/api/csrf`

Authentication: public.

Owner: auth/security.

Issues a CSRF token for browser clients using the OAuth2 session model.

Response:

```json
{
  "headerName": "X-XSRF-TOKEN",
  "parameterName": "_csrf",
  "token": "csrf-token-value"
}
```

Side effects: sets the `XSRF-TOKEN` cookie only. It does not create application
data.

### Unsafe API CSRF Rule

All unsafe API requests must send `X-XSRF-TOKEN` with the token obtained from
`GET /api/csrf`.

Unsafe documented routes:

- `POST /logout`
- `PUT /api/profile`
- `POST /api/vocab`
- `PUT /api/vocab/{id}`
- `DELETE /api/vocab/{id}`
- `DELETE /api/vocab/uid/{wordUid}`
- `POST /api/sync`
- `POST /api/quiz-results`
- `POST /api/quiz/attempts`
- `POST /api/quiz/attempts/{attemptId}/submit`
- `POST /api/review/answer`
- `POST /api/review/known`
- `POST /api/admin/sample-words`
- `POST /api/ai/explain-wrong-answer`
- `POST /api/ai/generate-deck`

## Auth, Profile, Health, And Logout

| Method | Path | Auth | Controller | Request | Response | Main tests |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/me` | Public; returns unauthenticated marker without session | `AuthController` | none | unauthenticated marker or `ProfileDto` | `ProfileSecurityTests`, `SecurityHeadersTests` |
| PUT | `/api/profile` | Auth + CSRF | `AuthController` | `ProfileRequest`: name, avatar, birthday, gender, goal, bio | updated `ProfileDto` and incremented sync revision | `ProfileSecurityTests`, `CsrfSecurityTests` |
| GET | `/api/health` | Public | `HealthController` | none | `{ "status": "ok", "app": "quiz-app" }` | `HealthCheckTests`, `ObservabilityAndRateLimitTests` |
| GET | `/api/health/summary` | Public | `HealthController` | none | health counter snapshot plus status/app | covered through controller/security smoke |
| POST | `/logout` | Session based + CSRF | Spring Security logout | none | `204 No Content`; deletes `JSESSIONID` and `XSRF-TOKEN` | `CsrfSecurityTests` |

`ProfileRequest` limits are enforced by Bean Validation and profile sanitizers:
name 120 chars, avatar 100000 chars and safe URL/data-image rules, gender 40,
goal 160, bio 2000, and birthday must not be in the future.

## OAuth Routes

| Method | Path | Auth | Owner | Notes |
| --- | --- | --- | --- | --- |
| GET | `/oauth2/authorization/google` | Public | Spring Security OAuth2 | Starts Google OAuth and adds `prompt=select_account`. |
| GET | `/login/oauth2/code/google` | Public | Spring Security OAuth2 | Google callback route. Success redirects to `app.oauth2.success-redirect-uri`. |

## Vocabulary And Sync

| Method | Path | Auth | Controller | Request | Response | Main tests |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/vocab` | Auth | `VocabularyController` | none | list of `WordDto` | `SpacedRepetitionTests`, `BackendHardeningTests` |
| POST | `/api/vocab` | Auth + CSRF | `VocabularyController` | `WordRequest` | created `WordDto`; `X-Sync-Revision` header | `SyncContractV2Tests`, `LearningAnalyticsTests` |
| PUT | `/api/vocab/{id}` | Auth + CSRF | `VocabularyController` | path `id`; `WordRequest` | updated `WordDto`; `X-Sync-Revision` header; changing existing `wordUid` is rejected | `SyncContractV2Tests` |
| DELETE | `/api/vocab/{id}` | Auth + CSRF | `VocabularyController` | path `id` | empty `200` plus `X-Sync-Revision`; creates tombstone and hard-deletes live row | `SyncContractV2Tests` |
| DELETE | `/api/vocab/uid/{wordUid}` | Auth + CSRF | `VocabularyController` | path UUID `wordUid` | empty `200` plus `X-Sync-Revision`; delete by stable identity | `SyncContractV2Tests` |
| GET | `/api/wrong-words` | Auth | `VocabularyController` | none | list of wrong-bank `WordDto` | sync/backend hardening tests |
| GET | `/api/snapshot` | Auth | `VocabularyController` | none | full `SyncResponse` snapshot | `SyncContractV2Tests`, `Audit005CapacityTests` |
| POST | `/api/sync` | Auth + CSRF | `VocabularyController` | `SyncRequest` | `SyncResponse` with revision, vocab, tombstones, progress, achievements, history | `SyncContractV2Tests`, `SyncRequestBodyLimitTests`, `Audit005CapacityTests` |
| GET | `/api/progress` | Auth | `VocabularyController` | none | `ProgressSummaryDto` | backend smoke/hardening tests |
| GET | `/api/achievements` | Auth | `VocabularyController` | none | list of `AchievementDto` | backend smoke/hardening tests |
| GET | `/api/quiz-history` | Auth | `VocabularyController` | none | list of `QuizHistoryDto` | backend smoke/hardening tests |
| POST | `/api/quiz-results` | Auth + CSRF | `VocabularyController` | body ignored | deterministic `410 Gone`, `QUIZ_RESULT_ENDPOINT_RETIRED`; no mutation | `Finding12QuizAttemptTests`, `BackendHardeningTests` |
| POST | `/api/quiz/attempts` | Auth + CSRF | `QuizAttemptController` | quiz mode, optional challenge seconds, and 1-500 unique owned word IDs with `eng`/`vie` direction | UUID attempt, 24-hour expiry, and issued ordinal/prompt context | `Finding12QuizAttemptTests` |
| POST | `/api/quiz/attempts/{attemptId}/submit` | Auth + CSRF | `QuizAttemptController` | complete unique ordinal/selected-answer list | immutable scored outcome, quiz/achievement XP, and current `SyncResponse`; `X-Sync-Revision` header | `Finding12QuizAttemptTests` |
| POST | `/api/admin/sample-words` | Auth + CSRF + admin role | `VocabularyController` | none | `SyncResponse` after starter import | auth/admin path covered by backend tests |

`WordRequest` requires `eng` and `vie` and accepts optional `id`, `wordUid`,
POS, tag, IPA, CEFR/level, context, example, example meaning, collocation,
synonyms, antonyms, common mistake, note, favorite/mastered flags, and stats.

`POST /api/quiz-results` is retained only as an authenticated retirement stub.
It does not deserialize or normalize the legacy body and cannot create an
attempt. Every authenticated call returns `410 Gone` with stable error code
`QUIZ_RESULT_ENDPOINT_RETIRED` and performs no reward, stats, history,
wrong-bank, achievement, or revision mutation.

`POST /api/quiz/attempts` is the additive server-issued online-attempt contract.
The server validates ownership, rejects duplicate words, captures the answer
context at issuance, and expires unconsumed attempts after 24 hours. The submit
contract accepts only each issued ordinal and its selected answer; it has no
client-authoritative XP, score, correctness, mastery, streak, combo, or revision
fields. Submission order and JSON property order do not affect the canonical
fingerprint.

Quiz modes are exact, case-sensitive identifiers: `quiz`, `challenge`,
`wrong-practice`, `favorites`, `daily`, `mixed`, `eng`, `vie`, `quick-add`,
`focus`, and `weak-words`. Whitespace/case variants are rejected rather than
normalized. Issued ordinals are server-assigned, contiguous from zero, and a
submit may send them in any order but must include each ordinal exactly once.

The first valid submit locks the owned attempt, recomputes correctness, and runs
the existing quiz reward/history path once. A retry with the same logical
payload returns `200` with `replayed: true`, the original immutable outcome, and
a freshly built current snapshot without another mutation. A different payload
for the consumed attempt returns `409` with
`QUIZ_ATTEMPT_REPLAY_CONFLICT`; an expired unconsumed attempt returns `409` with
`QUIZ_ATTEMPT_EXPIRED`. An attempt belonging to another user uses the same
non-disclosing `400` not-found behavior as an unknown attempt.

The online frontend uses only the attempt routes. It binds the issued attempt,
ordinals, word identity, direction, and prompt before rendering; submit retries
reuse the same attempt ID and byte-identical logical payload. If issuance is not
available, the round remains local-only and never falls back to the retired
route or claims cloud reward retroactively.
Attempt/retry state is memory-only. Home/reset, logout, or a full reload ends
that retry lifecycle; reload-resilient delivery is not implemented. Late
responses cannot overwrite a replacement quiz or another account's state.

Finding 12 remains partially fixed after Batch 12B because Review Today remains
self-rated without attempt identity, Mark Known/Hard retry semantics are
unchanged, and seven-day consumed-attempt cleanup is documented but not
physically implemented.

## Sync Contract V2

`POST /api/sync` requires `syncContractVersion: 2` and `expectedRevision`.
Missing or wrong contract version returns `400` with
`error: "SYNC_CLIENT_UPGRADE_REQUIRED"`. Missing or stale `expectedRevision`
returns `409` with `error: "SYNC_REVISION_CONFLICT"` and performs no mutation.

Vocabulary items in sync must include `wordUid` (UUID). The numeric `id` remains
the database primary key and direct CRUD compatibility identifier, but sync
identity is `wordUid`; English text is not used as a Sync V2 upsert key.
`wrongWords` in the request is deprecated and ignored for vocabulary creation or
updates.

`POST /api/sync` is capped before JSON request-body deserialization. The default
limit is `1048576` bytes and can be changed with
`app.sync.max-request-body-bytes` or `SYNC_MAX_REQUEST_BODY_BYTES`. Oversized
sync bodies return `413 Payload Too Large` with the standard `ApiError` shape.

Request shape:

```json
{
  "syncContractVersion": 2,
  "expectedRevision": 3,
  "profile": {},
  "vocab": [
    {
      "wordUid": "7b8f0d4a-0c87-4e44-9f53-1455f67c4a30",
      "eng": "focus",
      "vie": "tap trung",
      "pos": "v"
    }
  ],
  "deletions": [
    {
      "wordUid": "2a13ee3f-30f3-40e2-a47a-502688fd0f3a"
    }
  ],
  "wrongWords": [],
  "wrongWordDeletions": [
    {
      "wordUid": "7b8f0d4a-0c87-4e44-9f53-1455f67c4a30"
    }
  ]
}
```

`wrongWordDeletions` is an optional intent list. The server deletes only the
authenticated user's matching wrong-bank entries whose canonical vocabulary
word has already reached mastered state (`streak >= 5`). The operation is part
of the same revision-protected sync transaction; stale revisions still return
`409` without partial deletion.

Response includes `syncContractVersion`, `revision`, `profile`, live `vocab`,
`tombstones`, `wrongWords`, `progress`, `achievements`, and `quizHistory`.
Tombstones win over live records with the same `wordUid`.

Tombstone response shape:

```json
{
  "wordUid": "2a13ee3f-30f3-40e2-a47a-502688fd0f3a",
  "legacyWordId": 123,
  "deletedAt": "2026-01-05T00:00:00Z",
  "deletedRevision": 8
}
```

`legacyWordId` is nullable and exists only to let upgraded legacy clients remove
old local words that have numeric `id` but never adopted the server `wordUid`.

## Review

| Method | Path | Auth | Controller | Request | Response | Main tests |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/review/today` | Auth | `ReviewController` | none | due review items | `SpacedRepetitionTests` |
| GET | `/api/review/queue` | Auth | `ReviewController` | optional query `limit`, `tag`, `level` | filtered review queue | `SpacedRepetitionTests`, `Audit005CapacityTests` |
| POST | `/api/review/answer` | Auth + CSRF | `ReviewController` | `ReviewAnswerRequest`: `wordId`, `correct`, optional `mode` | summary plus authoritative updated `word`; `X-Sync-Revision` header | `SpacedRepetitionTests`, `AuditFindingsFiveToNineTests` |
| POST | `/api/review/known` | Auth + CSRF | `ReviewController` | `MarkKnownRequest`: `wordId` | server-authoritative minimum streak/mastery state plus updated `word`; `X-Sync-Revision` header | `AuditFindingsFiveToNineTests` |

Successful authenticated mutations that advance cloud state return the new
revision in `X-Sync-Revision`. Browser CORS exposes this header so the frontend
can use the revision on its next sync instead of manufacturing an avoidable
conflict. The header is additive; existing JSON response bodies remain
compatible.

## Analytics

| Method | Path | Auth | Controller | Response | Main tests |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/analytics/overview` | Auth | `LearningAnalyticsController` | totals, mastered/struggling words, weekly XP, insights | `LearningAnalyticsTests`, `Audit005CapacityTests` |
| GET | `/api/analytics/accuracy-trend` | Auth | `LearningAnalyticsController` | list of accuracy buckets | `LearningAnalyticsTests` |
| GET | `/api/analytics/weak-words` | Auth | `LearningAnalyticsController` | weak word list | `LearningAnalyticsTests` |
| GET | `/api/analytics/review-pressure` | Auth | `LearningAnalyticsController` | due/overdue/mastered review pressure | `LearningAnalyticsTests` |
| GET | `/api/analytics/tag-performance` | Auth | `LearningAnalyticsController` | tag, level, and quiz mode performance | `LearningAnalyticsTests`, `Audit005CapacityTests` |

Analytics calendar-day semantics are backend-configured and do not depend on
the host JVM timezone. `ANALYTICS_DEFAULT_ZONE` accepts an IANA `ZoneId` and
defaults to `UTC`; blank or invalid values fall back to UTC. Accuracy trend
buckets and overdue-day boundaries use this zone. Due review checks and weekly
windows remain instant/duration based. There is currently no timezone request
header or per-user timezone field, so the API contract is unchanged.

## AI

AI endpoints require an authenticated user, CSRF, and the in-memory per-user AI
rate limit. Without `OPENAI_API_KEY`, the backend uses rule-based fallback.

| Method | Path | Auth | Controller | Request | Response | Main tests |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/ai/explain-wrong-answer` | Auth + CSRF + rate limit | `AiExplanationController` | `ExplainWrongAnswerRequest` with word, user/correct answer, mode/tag/level/context | explanation response with `source` of `openai` or `fallback` | `AiExplanationTests`, `AiExplanationFallbackTests`, `AiRateLimitTests` |
| POST | `/api/ai/generate-deck` | Auth + CSRF + rate limit | `AiDeckGeneratorController` | `GenerateDeckRequest`: text, targetLevel, maxWords | generated deck response with `source` and items | `AiDeckGeneratorTests`, `AiDeckGeneratorFallbackTests`, `AiRateLimitTests` |

`GenerateDeckRequest.text` is limited to 8000 chars, target level must be Any or
A1-C2, and `maxWords` is clamped to 1-30.

## Actuator

These endpoints are available only when exposed by
`management.endpoints.web.exposure.include`. Health and info are public; metrics
are protected so anonymous clients cannot inspect operational metric names,
tags, or values.

| Method | Path | Auth | Owner | Response | Main tests |
| --- | --- | --- | --- | --- | --- |
| GET | `/actuator/health` | Public | Spring Boot Actuator | safe health without details | `HealthCheckTests` |
| GET | `/actuator/info` | Public | Spring Boot Actuator + `WordArenaInfoContributor` | non-secret app, AI enabled, Flyway enabled, and rate-limit metadata | `HealthCheckTests` |
| GET | `/actuator/metrics` | Authenticated session | Spring Boot Actuator/Micrometer | available metric names | `ObservabilityAndRateLimitTests` |
| GET | `/actuator/metrics/{name}` | Authenticated session | Spring Boot Actuator/Micrometer | selected metric details | `ObservabilityAndRateLimitTests` |

## Environment Keys Used By Backend

Canonical deployment guidance is in `docs/DEPLOYMENT.md`. The backend currently
reads these environment keys directly or through Spring placeholders:

| Key | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `SESSION_COOKIE_SAME_SITE` | Session/CSRF cookie SameSite value. |
| `SESSION_COOKIE_SECURE` | Session/CSRF cookie Secure flag. |
| `SESSION_COOKIE_PATH` | Session/CSRF cookie path. |
| `FRONTEND_URL` | Frontend base URL and default OAuth success target. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed browser origins. |
| `OAUTH_SUCCESS_REDIRECT_URI` | OAuth success redirect override. |
| `APP_SECURITY_HSTS_ENABLED` | Enables HSTS on HTTPS responses. |
| `AI_MODEL` | OpenAI model name used by AI clients. |
| `OPENAI_API_KEY` | Optional OpenAI key; fallback is used when blank. |
| `RATE_LIMIT_MODE` | AI rate-limit mode, currently `in-memory`. |
| `AI_RATE_LIMIT_MINUTE_WINDOW` | AI minute-window duration. |
| `AI_EXPLAIN_RATE_LIMIT_PER_MINUTE` | Explain endpoint per-minute limit. |
| `AI_EXPLAIN_RATE_LIMIT_PER_DAY` | Explain endpoint per-day limit. |
| `AI_DECK_RATE_LIMIT_PER_MINUTE` | Deck endpoint per-minute limit. |
| `AI_DECK_RATE_LIMIT_PER_DAY` | Deck endpoint per-day limit. |
| `ANALYTICS_DEFAULT_ZONE` | IANA zone for backend analytics calendar dates; defaults/falls back to `UTC`. |
| `DATABASE_URL` | JDBC datasource URL. |
| `DATABASE_USERNAME` | Datasource username. |
| `DATABASE_PASSWORD` | Datasource password. |
| `JPA_DDL_AUTO` | Hibernate schema mode. |
| `FLYWAY_ENABLED` | Flyway enable flag. |
| `FLYWAY_BASELINE_ON_MIGRATE` | Flyway baseline-on-migrate flag. |
| `FLYWAY_BASELINE_VERSION` | Flyway baseline marker version. |
| `FLYWAY_BASELINE_DESCRIPTION` | Flyway baseline marker description. |
| `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE` | Exposed actuator endpoints. |
| `LOGGING_LEVEL_ROOT` | Root logging level. |
| `LOGGING_LEVEL_SECURITY` | Spring Security logging level. |
| `APP_VERSION` | Actuator info app version. |
| `APP_ENV` | Actuator info environment label. |
| `SYNC_MAX_REQUEST_BODY_BYTES` | Pre-deserialization cap for `POST /api/sync`. |

## Migration Version

Flyway migrations live under `backend/src/main/resources/db/migration`. The
latest migration at this commit is:

```text
V6__capture_quiz_attempt_achievement_xp.sql
```
