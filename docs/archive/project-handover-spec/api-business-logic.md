# Project Handover - API And Business Logic

Historical split from $source lines 666-1270. Content preserved for reference.

## 7. API

Táº¥t cáº£ endpoint trá»« public health/auth bootstrap cáº§n authenticated principal vĂ¬ SecurityConfig yĂªu cáº§u `.anyRequest().authenticated()`.

### Auth/profile

#### `GET /api/me`

- Authentication: public endpoint, nhÆ°ng tráº£ authenticated false náº¿u khĂ´ng cĂ³ principal.
- Request: khĂ´ng cĂ³ body.
- Response unauth:

```json
{ "authenticated": false }
```

- Response auth:

```json
{
  "authenticated": true,
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "avatar": "https://example.com/avatar.png",
  "birthday": "2000-01-01",
  "gender": "female",
  "goal": "IELTS",
  "bio": "Learning daily",
  "xp": 120,
  "level": 1,
  "streak": 3,
  "bestStreak": 5
}
```

Errors: runtime user lookup error tráº£ 500 qua `GlobalExceptionHandler`.

#### `PUT /api/profile`

- Authentication: required.
- Request body `ProfileRequest`.

```json
{
  "name": "Alice",
  "avatar": "https://example.com/avatar.png",
  "birthday": "2000-01-01",
  "gender": "female",
  "goal": "Learn 20 words/day",
  "bio": "IELTS learner"
}
```

- Validation: name max 120, avatar max 100000, birthday past/present, gender max 40, goal max 160, bio max 2000.
- Response: `ProfileDto`.
- Error: 400 validation, 401 redirect to Google if unauth, 500 unexpected.

### Vocabulary and sync

#### `GET /api/vocab`

- Authentication: required.
- Response: array `WordDto`.

```json
[
  {
    "id": 10,
    "eng": "resilient",
    "vie": "kiĂªn cÆ°á»ng",
    "pos": "adj",
    "tag": "mindset",
    "ipa": "/rÉªËˆzÉªliÉ™nt/",
    "level": "B1",
    "context": "able to recover",
    "example": "She is resilient.",
    "exampleMeaning": "CĂ´ áº¥y kiĂªn cÆ°á»ng.",
    "collocation": "resilient learner",
    "synonyms": "strong",
    "antonyms": "fragile",
    "commonMistake": "Use for recovery ability.",
    "note": "",
    "favorite": false,
    "mastered": false,
    "stats": {
      "seen": 1,
      "correct": 1,
      "wrong": 0,
      "streak": 1,
      "bestStreak": 1,
      "mastery": 1,
      "lastReviewed": "2026-07-30T10:00:00Z",
      "nextReview": "2026-07-31T10:00:00Z"
    },
    "createdAt": "2026-07-30T09:00:00Z",
    "updatedAt": "2026-07-30T10:00:00Z"
  }
]
```

#### `POST /api/vocab`

- Authentication: required.
- Request: `WordRequest`.

```json
{
  "eng": "focus",
  "vie": "sá»± táº­p trung",
  "pos": "n",
  "tag": "study",
  "level": "A2",
  "favorite": false,
  "mastered": false
}
```

- Validation: `eng`/`vie` not blank max 255, optional text max theo DTO, id positive náº¿u cĂ³, stats valid.
- Business rule: duplicate English normalized theo user bá»‹ reject báº±ng `IllegalArgumentException`.
- Response: created `WordDto`.
- Error: 400 validation/duplicate, 401 auth, 500 unexpected.

#### `PUT /api/vocab/{id}`

- Authentication: required.
- Path: `id` Long.
- Request: `WordRequest`.
- Response: updated `WordDto`.
- Error: 400 náº¿u word khĂ´ng tá»“n táº¡i hoáº·c duplicate, 401 auth.

#### `DELETE /api/vocab/{id}`

- Authentication: required.
- Response: empty body.
- Business rule: idempotent, náº¿u word khĂ´ng tá»“n táº¡i thĂ¬ service bá» qua.

#### `GET /api/wrong-words`

- Authentication: required.
- Response: array `WordDto` tá»« `WrongBankEntry.word`.

#### `GET /api/snapshot`

- Authentication: required.
- Response: `SyncResponse`.

```json
{
  "revision": 4,
  "profile": { "authenticated": true, "id": 1, "name": "Alice", "email": "alice@example.com" },
  "vocab": [],
  "wrongWords": [],
  "progress": {
    "totalWords": 0,
    "masteredWords": 0,
    "dueToday": 0,
    "weeklyReviews": 0,
    "weeklyCorrect": 0,
    "weeklyAverage": 0.0,
    "quizCount": 0,
    "achievementCount": 0
  },
  "achievements": [],
  "quizHistory": []
}
```

#### `POST /api/sync`

- Authentication: required.
- Request: `SyncRequest`.

```json
{
  "expectedRevision": 4,
  "profile": { "name": "Alice", "goal": "Daily review" },
  "vocab": [
    { "eng": "calm", "vie": "bĂ¬nh tÄ©nh", "pos": "adj", "level": "A2" }
  ],
  "wrongWords": []
}
```

- Validation: vocab/wrongWords max 5000 entries; nested DTO validation.
- Business rule: if `expectedRevision != user.syncRevision`, throw `SyncRevisionConflictException`.
- Success response: `SyncResponse` with incremented revision.
- Conflict response 409:

```json
{
  "error": "SYNC_REVISION_CONFLICT",
  "message": "Cloud data changed. Pull the latest snapshot before syncing.",
  "expectedRevision": 4,
  "currentRevision": 5
}
```

#### `GET /api/progress`

- Authentication: required.
- Response: `ProgressSummaryDto`.

#### `GET /api/achievements`

- Authentication: required.
- Response: array `AchievementDto`.

#### `GET /api/quiz-history`

- Authentication: required.
- Response: array `QuizHistoryDto`, newest first.

#### `POST /api/admin/sample-words`

- Authentication: required.
- Authorization: `AppUser.role` must equal `ADMIN`, otherwise 403.
- Request: no body.
- Response: `SyncResponse` after upsert starter words.

#### `POST /api/quiz-results`

- Authentication: required.
- Request: `QuizResultRequest`.

```json
{
  "quizMode": "mixed",
  "challengeSeconds": 60,
  "total": 10,
  "correct": 8,
  "wrong": 2,
  "score": 8.0,
  "maxCombo": 5,
  "answers": [
    {
      "eng": "focus",
      "questionMode": "eng",
      "selectedAnswer": "sá»± táº­p trung",
      "correctAnswer": "sá»± táº­p trung",
      "correct": true
    }
  ]
}
```

- Validation: answers not null max 500; numeric fields clamped in record constructor; score finite 0..10.
- Response: `SyncResponse`.

### Review

#### `GET /api/review/today`

- Authentication: required.
- Response: array `ReviewQueueItemDto`.

#### `GET /api/review/queue`

- Authentication: required.
- Query:
  - `limit`: optional Integer.
  - `tag`: optional String.
  - `level`: optional String.
- Response:

```json
[
  {
    "word": { "id": 10, "eng": "focus", "vie": "sá»± táº­p trung" },
    "masteryPercent": 40,
    "overdueDays": 2,
    "priority": 55,
    "reason": "Overdue review"
  }
]
```

#### `POST /api/review/answer`

- Authentication: required.
- Request:

```json
{ "wordId": 10, "correct": true, "mode": "good" }
```

- Validation: wordId not null positive, mode max 40.
- Response:

```json
{
  "wordId": 10,
  "masteryPercent": 60,
  "currentStreak": 3,
  "nextReview": "2026-08-06T10:00:00Z",
  "message": "Nice review streak"
}
```

### Analytics

All authenticated.

| Endpoint | Method | Response |
|---|---|---|
| `/api/analytics/overview` | GET | `AnalyticsOverviewDto`: word counts, weekly XP, accuracy, streak, insights. |
| `/api/analytics/accuracy-trend` | GET | Array `AccuracyTrendDto(date, accuracy, totalQuestions)`. |
| `/api/analytics/weak-words` | GET | Array `WeakWordDto`. |
| `/api/analytics/review-pressure` | GET | `ReviewPressureDto(dueToday, overdue, mastered, struggling, learning)`. |
| `/api/analytics/tag-performance` | GET | `TagPerformanceDto(tagMetrics, levelMetrics, quizModeMetrics)`. |

Example overview:

```json
{
  "totalWords": 50,
  "masteredWords": 12,
  "learningWords": 30,
  "strugglingWords": 8,
  "averageAccuracy": 72.5,
  "weeklyXp": 180,
  "totalQuizzes": 9,
  "currentStreak": 4,
  "bestStreak": 7,
  "insights": [
    { "type": "overdue-review", "title": "Review queue", "message": "3 words are overdue.", "priority": 80 }
  ]
}
```

### AI

#### `POST /api/ai/explain-wrong-answer`

- Authentication: required.
- Rate limit: in-memory theo user/action, default explain 10/min vĂ  100/day.
- Request:

```json
{
  "word": "focus",
  "userAnswer": "sá»± chĂº Ă½",
  "correctAnswer": "sá»± táº­p trung",
  "questionMode": "eng",
  "tag": "study",
  "level": "A2",
  "example": "Keep your focus.",
  "note": "Noun"
}
```

- Response:

```json
{
  "word": "focus",
  "shortMeaning": "sá»± táº­p trung",
  "whyWrong": "Your answer is close but less precise.",
  "correctUsage": "Use focus for concentrated attention.",
  "example": "Keep your focus during review.",
  "memoryTip": "Link focus with a clear study target.",
  "collocations": ["keep focus", "lose focus"],
  "commonMistake": "Do not confuse with a general notice.",
  "source": "openai"
}
```

- Fallback: náº¿u OpenAI khĂ´ng Ä‘Æ°á»£c cáº¥u hĂ¬nh hoáº·c lá»—i, tráº£ response `source` fallback.
- Error 429:

```json
{
  "error": "AI_RATE_LIMITED",
  "message": "AI requests are temporarily limited. Please try again soon.",
  "retryAfterSeconds": 30
}
```

#### `POST /api/ai/generate-deck`

- Authentication: required.
- Rate limit: default deck 3/min vĂ  20/day.
- Request:

```json
{
  "text": "Students should review evidence and compare ideas.",
  "targetLevel": "B1",
  "maxWords": 10
}
```

- Validation: text not blank max 8000, targetLevel pattern `any|a1|a2|b1|b2|c1|c2`, maxWords 1..30.
- Response:

```json
{
  "items": [
    {
      "english": "evidence",
      "vietnameseMeaning": "báº±ng chá»©ng",
      "partOfSpeech": "n",
      "level": "B1",
      "exampleSentence": "Students review evidence.",
      "tag": "academic",
      "source": "openai"
    }
  ],
  "source": "openai"
}
```

### Health

#### `GET /api/health`

- Authentication: public.

```json
{ "status": "ok", "app": "quiz-app" }
```

#### `GET /api/health/summary`

- Authentication: public.
- Response: app status plus in-memory counters: `syncConflicts`, `aiFailures`, `reviewFailures`, `validationErrors`, `serverErrors`, `snapshotFailures`, `quizFailures`, `analyticsFailures`, `since`, `uptimeSeconds`.

## 8. Business Logic

### `CurrentUserService`

Chá»©c nÄƒng:

- Chuyá»ƒn OAuth2 principal thĂ nh `AppUser`.
- Lookup theo Google `sub`, fallback email lower-case.
- Tá»± táº¡o user náº¿u chÆ°a tá»“n táº¡i.
- Cáº­p nháº­t email, google subject, name/avatar náº¿u cĂ²n trá»‘ng, `lastActiveDate=LocalDate.now()`.
- `requireAdmin` kiá»ƒm tra role `ADMIN`.

Äiá»u kiá»‡n Ä‘áº·c biá»‡t:

- KhĂ´ng cĂ³ principal hoáº·c email trá»‘ng dáº«n tá»›i `IllegalStateException`.
- KhĂ´ng dĂ¹ng Spring GrantedAuthority cho admin endpoint, mĂ  kiá»ƒm tra field role trong service.

### `VocabularyService`

Chá»©c nÄƒng:

- CRUD vocabulary.
- List wrong words.
- Snapshot/sync cloud.
- Import starter words.
- Ghi quiz result, cáº­p nháº­t stats/XP/achievement.

Thuáº­t toĂ¡n CRUD:

1. Lock user báº±ng `AppUserRepository.findByIdForSyncUpdate`.
2. Validate duplicate English báº±ng normalized trim/lowercase trĂªn danh sĂ¡ch tá»« user.
3. Apply request vĂ o entity.
4. Save entity.
5. Increment `syncRevision`.

Sync:

1. Lock user.
2. So sĂ¡nh `expectedRevision` vá»›i `user.syncRevision`.
3. Náº¿u mismatch, tráº£ 409 conflict.
4. Apply profile náº¿u cĂ³.
5. Upsert tá»«ng vocab word theo English.
6. Upsert wrong words vĂ  wrong bank entry.
7. Increment revision.
8. Tráº£ snapshot.

Quiz result:

1. Lock user.
2. Táº¡o `QuizHistory`.
3. Vá»›i tá»«ng answer, tĂ¬m word theo English.
4. Cáº­p nháº­t `WordStats`.
5. Táº¡o hoáº·c cáº­p nháº­t `WrongBankEntry`.
6. TĂ­nh XP `correct * 12 + total * 3 + maxCombo`.
7. Cáº­p nháº­t level `xp / 250 + 1`.
8. Unlock achievement theo Ä‘iá»u kiá»‡n.
9. Increment revision vĂ  tráº£ snapshot.

### `LearningProgressService`

Chá»©c nÄƒng:

- TĂ­nh progress summary.
- TĂ­nh lá»‹ch Ă´n tiáº¿p theo.

Lá»‹ch review:

- Tráº£ lá»i sai: 1 ngĂ y.
- Streak Ä‘Ăºng 0 hoáº·c 1: 1 ngĂ y.
- Streak 2: 3 ngĂ y.
- Streak 3: 7 ngĂ y.
- Streak 4: 14 ngĂ y.
- Streak tá»« 5: 30 ngĂ y.

### `AchievementService`

Chá»©c nÄƒng:

- List achievement Ä‘Ă£ unlock.
- Unlock achievement idempotent.
- Náº¿u achievement code chÆ°a cĂ³ trong DB, táº¡o default achievement trong code.
- Khi unlock, cá»™ng XP reward vĂ  tĂ­nh láº¡i level.

### `SpacedRepetitionService`

Chá»©c nÄƒng:

- Táº¡o queue review theo due date, filter tag/level, limit.
- Ghi nháº­n cĂ¢u tráº£ lá»i review.

Queue:

1. Láº¥y toĂ n bá»™ words cá»§a user.
2. Chá»‰ chá»n tá»« cĂ³ `stats.nextReview <= now`.
3. Filter tag/level case-insensitive náº¿u cĂ³.
4. TĂ­nh `priority`.
5. Sort priority giáº£m dáº§n.
6. Limit náº¿u `limit > 0`.

Priority:

- `lowMastery = (5 - mastery) * 8`.
- Wrong count contribution `wrong * 6`, cap 30.
- Overdue days contribution `overdueDays * 5`, cap 30.
- Bound 0..100.

Answer:

- ÄĂºng: tÄƒng seen/correct/streak/best/mastery, cĂ³ thá»ƒ mastered.
- Sai: tÄƒng seen/wrong, reset streak, giáº£m mastery, mastered false.
- Cáº­p nháº­t `nextReview`.
- Increment `syncRevision`.

### `LearningAnalyticsService`

Chá»©c nÄƒng:

- Tá»•ng quan sá»‘ tá»«, mastered/learning/struggling.
- Xu hÆ°á»›ng accuracy theo ngĂ y.
- Weak words.
- Review pressure.
- Performance theo tag, level, quiz mode.

Quy táº¯c:

- Mastered náº¿u `word.mastered` hoáº·c `stats.mastery >= 5`.
- Struggling náº¿u review count >= 3, wrong >= 2 vĂ  accuracy < 60.
- Weak word náº¿u accuracy < 70 hoáº·c wrong >= 3.
- Weekly XP tĂ­nh tá»« quiz history 7 ngĂ y gáº§n nháº¥t báº±ng cĂ´ng thá»©c quiz XP.

### `LearningInsightService`

Sinh tá»‘i Ä‘a 4 insight:

- Weak tag náº¿u tag cĂ³ review count >=3 vĂ  accuracy <60.
- Weak quiz mode náº¿u mode cĂ³ review count >=3 vĂ  accuracy <65.
- Overdue review náº¿u cĂ³ tá»« overdue.
- Weekly improvement náº¿u ná»­a sau trend tá»‘t hÆ¡n ná»­a Ä‘áº§u Ă­t nháº¥t 10 Ä‘iá»ƒm.
- Fallback steady progress náº¿u khĂ´ng cĂ³ insight nĂ o.

### AI services

`AiRateLimitService`:

- Key theo action vĂ  user id/email.
- DĂ¹ng `ConcurrentHashMap`, per-minute deque vĂ  day count UTC.
- Dá»n entry stale má»—i 100 láº§n check.
- Throw `AiRateLimitExceededException` náº¿u vÆ°á»£t limit.

`AiExplanationService`:

- Náº¿u OpenAI chÆ°a cáº¥u hĂ¬nh, dĂ¹ng `RuleBasedExplanationService`.
- Náº¿u OpenAI lá»—i runtime, tÄƒng `aiFailures` vĂ  fallback.

`OpenAiExplanationClient`:

- Gá»i OpenAI Responses API báº±ng Java `HttpClient`.
- DĂ¹ng strict JSON schema.
- Parse `output_text` hoáº·c `output[].content[].text`.
- Guardrail parse JSON qua `AiJsonGuardrails`.

`AiDeckGeneratorService` vĂ  `OpenAiDeckGeneratorClient`:

- TÆ°Æ¡ng tá»± explanation, nhÆ°ng schema tráº£ list deck words.
- Deduplicate theo English normalized.
- Validate level A1..C2 vĂ  Ä‘á»™ dĂ i field.
- Fallback dictionary trong `RuleBasedDeckGeneratorService`.

### Frontend business logic

- `storage.js`: tĂ¡ch dá»¯ liá»‡u theo account key `quizAccount:{accountId}:...`, migrate guest data má»™t láº§n khi user Ä‘Äƒng nháº­p.
- `vocab.js`: validate local word, prevent duplicate, update local stats and wrong bank.
- `quiz.js`: táº¡o quiz options tá»« vocab, lock answer sau khi chá»n, ghi local stats, gá»i AI explanation cho wrong answer.
- `app.js`: auth bootstrap, snapshot pull trÆ°á»›c push, sync conflict handling, delete queue backoff, stale device guard.
- `analytics-dashboard.js`: Æ°u tiĂªn cloud analytics, fallback local.
- `review-today.js`: Æ°u tiĂªn backend queue, fallback local due words.
- `learning-studio.js`: deck import, AI deck, CSV parser, profile/history/badges/focus UI.

