# Project Handover - Diagrams Config And Operations

Historical split from $source lines 1623-2205. Content preserved for reference.

## 13. Class Diagram

```mermaid
classDiagram
    class AppUser {
      Long id
      String email
      String googleSubject
      String displayName
      String role
      Integer xp
      Integer level
      Integer streak
      Long syncRevision
    }
    class VocabularyWord {
      Long id
      String eng
      String vie
      String pos
      String tag
      String level
      Boolean favorite
      Boolean mastered
    }
    class WordStats {
      Long id
      Integer seen
      Integer correct
      Integer wrong
      Integer currentStreak
      Integer masteryLevel
      Instant nextReview
    }
    class WrongBankEntry {
      Long id
      Boolean mastered
    }
    class QuizHistory {
      Long id
      Integer totalQuestions
      Integer correctAnswers
      BigDecimal score
      String quizMode
    }
    class QuizHistoryAnswer {
      Long id
      String prompt
      String selectedAnswer
      Boolean correct
    }
    class Achievement {
      Long id
      String code
      String name
      Integer xpReward
    }
    class UserAchievement {
      UserAchievementId id
      Instant unlockedAt
    }

    AppUser "1" --> "*" VocabularyWord
    VocabularyWord "1" --> "0..1" WordStats
    AppUser "1" --> "*" WrongBankEntry
    VocabularyWord "1" --> "*" WrongBankEntry
    AppUser "1" --> "*" QuizHistory
    QuizHistory "1" --> "*" QuizHistoryAnswer
    VocabularyWord "0..1" --> "*" QuizHistoryAnswer
    AppUser "1" --> "*" UserAchievement
    Achievement "1" --> "*" UserAchievement
```

## 14. ER Diagram

```mermaid
erDiagram
    APP_USERS ||--o{ VOCABULARY : owns
    VOCABULARY ||--|| WORD_STATS : has
    APP_USERS ||--o{ WRONG_BANK : has
    VOCABULARY ||--o{ WRONG_BANK : appears_in
    APP_USERS ||--o{ QUIZ_HISTORY : takes
    QUIZ_HISTORY ||--o{ QUIZ_HISTORY_ANSWERS : contains
    VOCABULARY ||--o{ QUIZ_HISTORY_ANSWERS : references
    APP_USERS ||--o{ USER_ACHIEVEMENTS : unlocks
    ACHIEVEMENTS ||--o{ USER_ACHIEVEMENTS : defines

    APP_USERS {
      bigint id PK
      varchar email UK
      varchar google_subject UK
      varchar role
      integer xp
      integer level
      bigint sync_revision
      timestamptz created_at
      timestamptz updated_at
    }
    VOCABULARY {
      bigint id PK
      bigint user_id FK
      varchar eng
      varchar vie
      varchar pos
      varchar tag
      varchar word_level
      boolean favorite
      boolean mastered
    }
    WORD_STATS {
      bigint id PK
      bigint word_id FK_UK
      integer seen
      integer correct
      integer wrong
      integer mastery_level
      timestamptz next_review
    }
    WRONG_BANK {
      bigint id PK
      bigint user_id FK
      bigint word_id FK
      boolean mastered
    }
    QUIZ_HISTORY {
      bigint id PK
      bigint user_id FK
      integer total_questions
      integer correct_answers
      numeric score
      varchar quiz_mode
    }
    QUIZ_HISTORY_ANSWERS {
      bigint id PK
      bigint quiz_history_id FK
      bigint word_id FK
      boolean is_correct
    }
    ACHIEVEMENTS {
      bigint id PK
      varchar code UK
      varchar name UK
      integer xp_reward
    }
    USER_ACHIEVEMENTS {
      bigint user_id PK,FK
      bigint achievement_id PK,FK
      timestamptz unlocked_at
    }
```

## 15. Dependency Graph

```mermaid
flowchart TD
    Frontend["frontend static JS"]
    ConfigJS["config.js"]
    StorageJS["storage.js"]
    VocabJS["vocab.js"]
    QuizJS["quiz.js"]
    AppJS["app.js"]
    AnalyticsJS["analytics-dashboard.js"]
    ReviewJS["review-today.js"]
    StudioJS["learning-studio.js"]

    Backend["Spring Boot"]
    Config["config"]
    User["user"]
    Auth["auth"]
    Vocab["vocab"]
    Review["review"]
    Analytics["analytics"]
    AI["ai"]
    Health["health"]
    Shared["shared"]
    DB["Database"]
    OpenAI["OpenAI optional"]

    Frontend --> ConfigJS
    Frontend --> StorageJS
    Frontend --> VocabJS
    Frontend --> QuizJS
    Frontend --> AppJS
    AppJS --> VocabJS
    AppJS --> QuizJS
    AppJS --> StorageJS
    AnalyticsJS --> AppJS
    ReviewJS --> VocabJS
    StudioJS --> VocabJS

    Backend --> Config
    Auth --> User
    Vocab --> User
    Vocab --> Health
    Review --> User
    Review --> Vocab
    Analytics --> Vocab
    Analytics --> Health
    AI --> User
    AI --> Health
    AI --> Config
    Shared --> Health
    User --> DB
    Vocab --> DB
    Review --> DB
    Analytics --> DB
    AI --> OpenAI
```

## 16. Cáº¥u hĂ¬nh

### `application.yml`

Nguá»“n cáº¥u hĂ¬nh:

- `spring.config.import`: optional `./.env`, `../.env`, `./config/oauth2-google.yml`.
- Google OAuth registration:
  - `client-id`: `${GOOGLE_CLIENT_ID:}`
  - `client-secret`: `${GOOGLE_CLIENT_SECRET:}`
  - `redirect-uri`: `{baseUrl}/login/oauth2/code/{registrationId}`
  - scopes: `openid`, `profile`, `email`
  - provider authorization/token/user-info/jwk/logout URI.
- Session cookie:
  - `server.servlet.session.cookie.same-site=${SESSION_COOKIE_SAME_SITE:lax}`
  - `secure=${SESSION_COOKIE_SECURE:false}`
  - `path=${SESSION_COOKIE_PATH:/}`
- Frontend:
  - `app.frontend.base-url=${FRONTEND_URL:http://localhost:5500/frontend}`
  - `app.frontend.origin=${CORS_ALLOWED_ORIGINS:${FRONTEND_URL:http://127.0.0.1:5500,http://localhost:5500}}`
- OAuth redirect:
  - success: `${app.frontend.base-url}/index.html`
  - logout: `${app.frontend.base-url}/login.html?loggedOut=true`
- AI:
  - enabled by presence of `OPENAI_API_KEY`.
  - model default `gpt-4.1-mini`.
  - responses URL default `https://api.openai.com/v1/responses`.
  - explain/deck minute and daily limits.

### `application.properties`

- App name `quizapp`.
- Datasource default H2, env-overridable `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`.
- `spring.jpa.hibernate.ddl-auto=${JPA_DDL_AUTO:update}`.
- `spring.jpa.open-in-view=false`.
- Flyway disabled default, locations `classpath:db/migration`, validate on migrate true, clean disabled.
- Thymeleaf template check disabled.
- Actuator exposes `health,info`.
- Info app name `WordArena`, version/env from variables.

### Environment variables

Tá»« `.env.example` vĂ  `backend/.env.example`:

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- DB: `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `JPA_DDL_AUTO`, `FLYWAY_ENABLED`.
- Frontend/backend: `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `BACKEND_URL`.
- Session: `SESSION_COOKIE_SAME_SITE`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_PATH`.
- AI: `OPENAI_API_KEY`, `AI_MODEL`, `OPENAI_RESPONSES_URL`, `AI_EXPLAIN_PER_MINUTE`, `AI_EXPLAIN_PER_DAY`, `AI_DECK_PER_MINUTE`, `AI_DECK_PER_DAY`.
- Release: `APP_VERSION`, `APP_ENV`.

### Frontend config

`frontend/js/config.js`:

- Production backend hardcoded: `https://quiz-app-xd9m.onrender.com`.
- Production frontend detection:
  - `quiz-app-rust-iota-39.vercel.app`
  - `wordarena.org`, `www.wordarena.org`
  - any `.vercel.app`
  - any non-local hostname
- Local backend default: `http://localhost:8080`.

### Docker

`backend/Dockerfile`:

1. Build stage `eclipse-temurin:17-jdk`.
2. Copy Maven wrapper and pom.
3. Run `./mvnw -B dependency:go-offline`.
4. Copy `src`.
5. Run `./mvnw -B clean package -DskipTests`.
6. Runtime stage `eclipse-temurin:17-jre`.
7. Copy jar to `/app/app.jar`.
8. Expose 8080.
9. CMD `java -Dserver.port=${PORT:-8080} -jar app.jar`.

Docker Compose: khĂ´ng cĂ³ file compose trong repository.

### Build/test config

- Backend test: `cd backend; .\mvnw.cmd test`.
- Backend jar: `cd backend; .\mvnw.cmd clean package -DskipTests`.
- Backend run: `cd backend; .\mvnw.cmd spring-boot:run`.
- Frontend smoke: `npm run test:frontend`.
- JS syntax check theo AGENTS khi Ä‘á»•i JS: `node --check frontend\js\...`.

## 17. Logging

Backend dĂ¹ng SLF4J Logger:

- `CurrentUserService`: log warn khi thiáº¿u principal/email, log login/new user/admin access. Email khĂ´ng Ä‘Æ°á»£c log rĂµ, chá»‰ user id.
- `VocabularyService`: log snapshot/sync/import/quiz result failures, sync revision conflict, word create/update/delete.
- `LearningAnalyticsService`: log analytics failures vĂ  tÄƒng counter.
- `AiExplanationService`/`AiDeckGeneratorService`: log OpenAI failure rá»“i fallback.
- `GlobalExceptionHandler`: log validation, malformed request, forbidden, sync conflict, rate limit, runtime exception.
- `StartupDiagnosticsLogger`: log khi app ready vá»›i profile, port, aiEnabled, flywayEnabled.

Frontend logging:

- DĂ¹ng `console.warn`, `console.error` á»Ÿ cĂ¡c module sync/analytics/review/AI khi fallback hoáº·c lá»—i.
- Smoke test cĂ³ kiá»ƒm tra app load khĂ´ng cĂ³ fatal console errors.

KhĂ´ng tháº¥y cáº¥u hĂ¬nh logging file/JSON/appender riĂªng trong repo. DĂ¹ng logging máº·c Ä‘á»‹nh Spring Boot console.

## 18. Exception Handling

`GlobalExceptionHandler` xá»­ lĂ½ táº­p trung:

| Exception | HTTP | Body | Counter |
|---|---:|---|---|
| `MethodArgumentNotValidException` | 400 | `ApiError("Validation failed.", details)` | `validationErrors` |
| `IllegalArgumentException` | 400 | `ApiError(message, [])` | `validationErrors` |
| `HttpMessageNotReadableException` | 400 | `ApiError("Malformed request body.", [])` | `validationErrors` |
| `AccessDeniedException` | 403 | `ApiError("Forbidden.", [message])` | none |
| `SyncRevisionConflictException` | 409 | `SyncConflictResponse` | `syncConflicts` |
| `AiRateLimitExceededException` | 429 | `AiRateLimitError.standard` | none |
| `RuntimeException` | 500 | `ApiError("Something went wrong.", [])` | `serverErrors` |

Service-level counters:

- `VocabularyService.snapshot` increments `snapshotFailures`.
- `VocabularyService.recordQuizResult` increments `quizFailures`.
- `LearningAnalyticsService` increments `analyticsFailures`.
- AI services increment `aiFailures` on OpenAI runtime failure.
- `SpacedRepetitionService.answer` increments `reviewFailures` on runtime failure.

Frontend error handling:

- Auth bootstrap retry `/api/me` theo delay `[500, 1000]`.
- Cloud sync 409 conflict dáº«n tá»›i pull snapshot.
- Delete cloud fail Ä‘Æ°a vĂ o queue vá»›i backoff.
- Analytics/review fallback local náº¿u cloud lá»—i.
- AI 429 hiá»ƒn thá»‹ retry-after/cooldown, malformed response dĂ¹ng fallback hoáº·c khĂ´ng freeze panel.

## 19. Validation

### Backend Bean Validation

| DTO | Validation |
|---|---|
| `ProfileRequest` | `name @Size(max=120)`, `avatar @Size(max=100000)`, `birthday @PastOrPresent`, `gender @Size(max=40)`, `goal @Size(max=160)`, `bio @Size(max=2000)`. |
| `WordRequest` | `id @Positive`, `eng @NotBlank @Size(max=255)`, `vie @NotBlank @Size(max=255)`, `pos @Size(max=50)`, `tag @Size(max=100)`, `ipa @Size(max=120)`, `level @Size(max=40)`, long text fields `@Size(max=2000)`, `stats @Valid`. |
| `WordStatsDto` | counts `@Min(0)`, mastery `@Min(0) @Max(5)`, `lastReviewed @PastOrPresent`; constructor clamps count max 1,000,000 and safe instants. |
| `SyncRequest` | `profile @Valid`, `vocab @Size(max=5000)`, `wrongWords @Size(max=5000)`, each word `@Valid`. |
| `QuizResultRequest` | numeric positive/zero, score 0..10, answers `@NotNull @Size(max=500) @Valid`; constructor clamps numeric ranges. |
| `QuizAnswerRequest` | `eng @NotBlank @Size(max=255)`, `questionMode @Size(max=20)`, `selectedAnswer @Size(max=2000)`, `correctAnswer @NotBlank @Size(max=2000)`. |
| `ReviewAnswerRequest` | `wordId @NotNull @Positive`, `mode @Size(max=40)`. |
| `ExplainWrongAnswerRequest` | `word @NotBlank @Size(max=255)`, `userAnswer @Size(max=2000)`, `correctAnswer @NotBlank @Size(max=2000)`, metadata max sizes. |
| `GenerateDeckRequest` | `text @NotBlank @Size(max=8000)`, `targetLevel @Pattern(any/a1/a2/b1/b2/c1/c2) @Size(max=8)`, `maxWords @Min(1) @Max(30)`. |

### Backend manual validation/business validation

- Duplicate word normalized by English per user.
- `sync` rejects stale `expectedRevision`.
- AI generated deck item guardrails reject blank/placeholder fields and invalid levels.
- `CurrentUserService` rejects missing principal/email.
- `requireAdmin` rejects non-admin role.

### Database constraints

- Not blank checks for vocabulary `eng`, `vie`.
- Non-negative checks for XP/streak/counts.
- Mastery 0..5.
- Score 0..10.
- Unique user/email/google subject, user vocabulary English, wrong bank, achievements.

### Frontend validation

- `vocab.js` requires English and Vietnamese.
- English max length 120 in frontend, stricter than backend max 255.
- Duplicate English by normalized lower-case.
- `learning-studio.js` validates generated/imported deck entries before import.
- AI deck client handles rate limit/malformed without freezing UI.

## 20. Thuáº­t toĂ¡n

### Spaced repetition fixed interval

Actual source dĂ¹ng fixed intervals, khĂ´ng dĂ¹ng SM-2:

```text
wrong -> next review +1 day
correct streak 1 -> +1 day
correct streak 2 -> +3 days
correct streak 3 -> +7 days
correct streak 4 -> +14 days
correct streak >=5 -> +30 days
```

Backend cĂ³ logic trong `LearningProgressService.nextReview` vĂ  `SpacedRepetitionService.nextReview`. Frontend mirror trong `vocab.js` vĂ  `review-today.js`.

### Review queue priority

```text
priority = (5 - mastery) * 8
         + min(30, wrong * 6)
         + min(30, overdueDays * 5)
bounded 0..100
```

### Quiz scoring and XP

- Score client gá»­i vá» bá»‹ clamp 0..10.
- XP server: `correct * 12 + total * 3 + maxCombo`.
- Level: `floor(xp / 250) + 1`.

### Weak word detection

- Analytics weak word: accuracy < 70 hoáº·c wrong >= 3.
- Struggling word: reviews >= 3, wrong >= 2, accuracy < 60.
- Frontend dashboard local weak candidate: wrong >=2 hoáº·c reviews >=3 vĂ  accuracy <70 hoáº·c overdue chÆ°a mastered.

### Sync merge client-side

- Merge key: server id náº¿u cĂ³ hoáº·c normalized English.
- Chá»n field theo `updatedAt` giá»¯a local vĂ  cloud.
- Cloud snapshot pháº£i Ä‘Æ°á»£c pull trÆ°á»›c push.
- Náº¿u thiáº¿t bá»‹ cĂ³ local data, cloud snapshot má»›i hÆ¡n vĂ  last sync quĂ¡ 7 ngĂ y thĂ¬ block push.
- Delete queue cĂ³ backoff: 0, 30 giĂ¢y, 5 phĂºt, 1 giá».

### AI JSON guardrails

- Strip markdown code fence.
- Parse JSON trá»±c tiáº¿p.
- Náº¿u fail, extract object/array candidate giá»¯a dáº¥u má»Ÿ Ä‘áº§u vĂ  Ä‘Ă³ng cuá»‘i cĂ¹ng.
- Validate fields vĂ  length trÆ°á»›c khi tráº£ DTO.

## 21. Hiá»‡u nÄƒng

### Query/index tá»‘i Æ°u hiá»‡n cĂ³

- `idx_vocabulary_user` há»— trá»£ list words theo user.
- `idx_vocabulary_user_lower_eng` há»— trá»£ lookup case-insensitive theo user náº¿u query táº­n dá»¥ng lower expression. Repository hiá»‡n dĂ¹ng derived method `findByUserAndEngIgnoreCase`, Hibernate cĂ³ thá»ƒ sinh lower comparison.
- `idx_vocabulary_user_tag` há»— trá»£ lá»c theo tag á»Ÿ DB náº¿u cĂ³ query tÆ°Æ¡ng á»©ng. Source hiá»‡n nhiá»u filter tag/level lĂ m trong memory.
- `idx_word_stats_next_review` há»— trá»£ due review náº¿u query trá»±c tiáº¿p theo next_review. Source hiá»‡n láº¥y all user words rá»“i filter trong Java.
- `idx_quiz_history_user_created` há»— trá»£ recent history vĂ  weekly history.
- `idx_quiz_answers_history` há»— trá»£ load answers theo quiz history.

### Transaction vĂ  locking

- `VocabularyService` dĂ¹ng `@Transactional` á»Ÿ service class.
- CĂ¡c thao tĂ¡c thay Ä‘á»•i sync-critical lock user báº±ng `@Lock(PESSIMISTIC_WRITE)` trong `AppUserRepository.findByIdForSyncUpdate`.
- `ReviewController.answer`/service update cÅ©ng lock user.
- `AuthController.updateProfile` cĂ³ `@Transactional`.

### Lazy loading

- Entity quan há»‡ user/word/history dĂ¹ng `FetchType.LAZY` cho nhiá»u association.
- `spring.jpa.open-in-view=false`, nĂªn service pháº£i map DTO trong transaction. CĂ¡c service hiá»‡n lĂ m mapping trong transactional context vá»›i class-level `@Transactional` á»Ÿ `VocabularyService` vĂ  method transactions á»Ÿ review/analytics implied by repository reads where needed.

### Cache

- KhĂ´ng cĂ³ server cache layer.
- Health/rate-limit counters lĂ  in-memory state, khĂ´ng pháº£i cache dá»¯ liá»‡u nghiá»‡p vá»¥.
- Frontend cache chĂ­nh lĂ  `localStorage` account-scoped.

### Batch processing

- `/api/sync` xá»­ lĂ½ batch vocab vĂ  wrongWords tá»‘i Ä‘a 5000 item.
- KhĂ´ng tháº¥y JDBC batch config hoáº·c bulk insert repository trong source.

## 22. Äiá»ƒm yáº¿u

### Code smell vĂ  technical debt

- Frontend phá»¥ thuá»™c global variables vĂ  thá»© tá»± script. `app.js` wrap nhiá»u hĂ m legacy nhÆ° `save`, `renderTable`, `finishQuiz`, lĂ m coupling cao.
- Nhiá»u business rule bá»‹ nhĂ¢n báº£n giá»¯a frontend vĂ  backend: spaced repetition interval, stats, weak word logic, sync normalization.
- `archive/` chá»©a source vĂ  binary cÅ© cĂ³ thá»ƒ lĂ m nhiá»…u tĂ¬m kiáº¿m, audit vĂ  tooling.
- `design-system.css` vĂ  `login-modern.css` tá»“n táº¡i nhÆ°ng khĂ´ng Ä‘Æ°á»£c load á»Ÿ app/login hiá»‡n táº¡i.
- Backend cĂ³ dependency Thymeleaf vĂ  Lombok nhÆ°ng source hiá»‡n khĂ´ng thá»ƒ hiá»‡n nhu cáº§u rĂµ rĂ ng.
- `application-oauth.yml` trĂ¹ng cáº¥u hĂ¬nh OAuth vá»›i `application.yml`, cĂ³ nguy cÆ¡ drift.
- Má»™t sá»‘ chuá»—i tiáº¿ng Viá»‡t trong Java source hiá»ƒn thá»‹ mojibake trong fallback/starter word code, trong khi curated deck frontend cĂ³ tiáº¿ng Viá»‡t Ä‘Ăºng dáº¥u.
- `GlobalExceptionHandler` log validation/malformed vá»›i prefix `[AUTH]` dĂ¹ lá»—i khĂ´ng chá»‰ thuá»™c auth.

### Data/sync risk

- `/api/sync` lĂ  upsert-only theo vocab/wrongWords, khĂ´ng cĂ³ tombstone hoáº·c danh sĂ¡ch deleted IDs trong payload.
- `sync_revision` báº£o vá»‡ push cáº¥p user nhÆ°ng khĂ´ng giáº£i quyáº¿t conflict cáº¥p tá»«ng word/field.
- Duplicate check service scan toĂ n bá»™ words cá»§a user trong Java. DB unique `(user_id, eng)` case-sensitive nĂªn chÆ°a khĂ³a normalized duplicate á»Ÿ DB.
- Client merge dá»±a trĂªn `updatedAt`; local timestamp do client táº¡o nĂªn cĂ³ rá»§i ro clock skew.
- Delete queue náº±m localStorage, náº¿u user clear browser storage thĂ¬ tombstone pending máº¥t.

### Security risk

- CSRF disabled trong khi app dĂ¹ng session cookie. CORS restricted giĂºp giáº£m rá»§i ro cross-origin, nhÆ°ng cookie session thÆ°á»ng cáº§n cĂ¢n nháº¯c CSRF token hoáº·c SameSite phĂ¹ há»£p.
- Admin authorization dá»±a trĂªn string role trong DB, khĂ´ng tĂ­ch há»£p Spring authorities.
- AI rate limit in-memory khĂ´ng chia sáº» giá»¯a nhiá»u instance vĂ  reset khi restart.
- OpenAI API key chá»‰ backend env, Ä‘Ăºng hÆ°á»›ng. KhĂ´ng tháº¥y key hardcode trong frontend.

### Performance issue

- Review queue vĂ  nhiá»u analytics láº¥y toĂ n bá»™ words cá»§a user rá»“i filter/tĂ­nh trong memory. Vá»›i vocab ráº¥t lá»›n, nĂªn Ä‘Æ°a due/tag/level query xuá»‘ng DB.
- Duplicate check táº¡o stream trĂªn toĂ n bá»™ list words cá»§a user.
- `/api/sync` tá»‘i Ä‘a 5000 words, nhÆ°ng xá»­ lĂ½ tá»«ng item qua repository lookup/save, chÆ°a cĂ³ batch insert/update rĂµ rĂ ng.
- Frontend render table DOM thá»§ cĂ´ng toĂ n bá»™ danh sĂ¡ch, chÆ°a cĂ³ virtualization.

### Observability gap

- Health counters reset khi restart, khĂ´ng persistent.
- KhĂ´ng cĂ³ metric timing/histogram hoáº·c trace.
- KhĂ´ng cĂ³ health counter `syncFailures` trong code dĂ¹ docs hardening cĂ³ nháº¯c tá»›i.

## 23. HÆ°á»›ng cáº£i tiáº¿n

### Refactor

- TĂ¡ch frontend thĂ nh module ES hoáº·c framework nháº¹, giáº£m global state vĂ  script-order dependency.
- ÄÆ°a business rules shared vĂ o má»™t nÆ¡i rĂµ rĂ ng hoáº·c sinh contract tá»« backend Ä‘á»ƒ frontend khĂ´ng tá»± nhĂ¢n báº£n.
- TĂ¡ch `app.js` thĂ nh cĂ¡c module: auth, sync, dashboard, profile, cloud vocabulary, quiz submit.
- Di chuyá»ƒn archive cÅ© ra khá»i working source hoáº·c thĂªm README rĂµ hÆ¡n cho archive.

### Thiáº¿t káº¿ tá»‘t hÆ¡n

- Vá»›i backend, giá»¯ layered architecture nhÆ°ng tĂ¡ch sync use case thĂ nh service riĂªng: `SyncService`, `VocabularyCrudService`, `QuizResultService`.
- DĂ¹ng domain event hoáº·c service method riĂªng cho achievement unlock thay vĂ¬ Ä‘áº·t trong nhiá»u luá»“ng.
- DĂ¹ng Spring Security authorities cho admin.
- Chuáº©n hĂ³a API error code thay vĂ¬ chá»‰ message string.

### Database

- ThĂªm unique index normalized English cho PostgreSQL, vĂ­ dá»¥ `(user_id, lower(btrim(eng)))`, sau khi cleanup duplicate production.
- ThĂªm query repository tá»‘i Æ°u:
  - due review theo user vĂ  `next_review <= now`.
  - duplicate lookup normalized.
  - weak words aggregated query náº¿u dá»¯ liá»‡u lá»›n.
- CĂ¢n nháº¯c migration luĂ´n enabled theo mĂ´i trÆ°á»ng staging/prod sau baseline an toĂ n.
- Xem xĂ©t tombstone table hoáº·c `deleted_at` Ä‘á»ƒ sync delete Ä‘a thiáº¿t bá»‹ cháº¯c hÆ¡n.

### API

- ThĂªm endpoint sync delta thay vĂ¬ snapshot toĂ n bá»™ khi dá»¯ liá»‡u lá»›n.
- ThĂªm ETag/revision per word hoáº·c `updated_at` server-authoritative.
- ThĂªm direct profile save frontend dĂ¹ng `PUT /api/profile` hoáº·c bá» endpoint náº¿u sync profile lĂ  Ä‘Æ°á»ng chĂ­nh.
- Chuáº©n hĂ³a pagination cho vocab, history, analytics weak words.

### UI

- Virtualize vocabulary table khi sá»‘ tá»« lá»›n.
- TĂ¡ch Learning Studio thĂ nh cĂ¡c component/module nhá».
- Chuáº©n hĂ³a design-system vĂ  loáº¡i CSS khĂ´ng dĂ¹ng.
- ThĂªm tráº¡ng thĂ¡i offline/sync conflict rĂµ hÆ¡n cho user.

### Security/ops

- ÄĂ¡nh giĂ¡ láº¡i CSRF cho session cookie production.
- Chuyá»ƒn rate limit/counters sang Redis hoáº·c persistent metrics náº¿u scale nhiá»u instance.
- ThĂªm structured logging vĂ  request correlation id.
- Bá»• sung alerts cho sync conflict, AI failure, validation spike.

## 24. TĂ³m táº¯t tĂ¡i táº¡o dá»± Ă¡n cho AI khĂ¡c

Äá»ƒ tĂ¡i táº¡o dá»± Ă¡n gáº§n giá»‘ng source hiá»‡n táº¡i:

1. Táº¡o má»™t static SPA trong `frontend/` báº±ng HTML/CSS/vanilla JS, khĂ´ng dĂ¹ng bundler. App chĂ­nh lĂ  `index.html`, login lĂ  `login.html`.
2. `index.html` pháº£i load nhiá»u CSS legacy vĂ  `modern.css`, rá»“i load cĂ¡c JS theo thá»© tá»±: `config`, `storage`, `vocab`, `ui`, `effects`, `timer`, `quiz`, `ai-explain`, `challenge`, `main`, `app`, `curated-decks`, `learning-studio`, `analytics-dashboard`, `review-today`.
3. DĂ¹ng global state `vocab`, `wrongWords`, quiz variables vĂ  account-scoped `localStorage`.
4. Frontend pháº£i local-first: má»i CRUD/quiz/review hoáº¡t Ä‘á»™ng Ä‘Æ°á»£c khi khĂ´ng cĂ³ backend; backend sync lĂ  enhancement khi auth.
5. Táº¡o backend Spring Boot 3.5.14 Java 17, Maven, package root `com.quizapp`.
6. DĂ¹ng Spring Security OAuth2 Client vá»›i Google, session cookie `JSESSIONID`, `/api/me` public Ä‘á»ƒ bootstrap, cĂ¡c API cĂ²n láº¡i authenticated trá»« health.
7. Táº¡o entities JPA: `AppUser`, `VocabularyWord`, `WordStats`, `WrongBankEntry`, `QuizHistory`, `QuizHistoryAnswer`, `Achievement`, `UserAchievement` vá»›i schema nhÆ° má»¥c Database.
8. Táº¡o repositories Spring Data JPA, trong Ä‘Ă³ `AppUserRepository.findByIdForSyncUpdate` dĂ¹ng pessimistic lock.
9. Táº¡o `VocabularyService` xá»­ lĂ½ CRUD, sync revision conflict, snapshot, quiz result, XP, achievements vĂ  starter words.
10. Táº¡o spaced repetition báº±ng fixed interval 1/3/7/14/30 ngĂ y theo streak, khĂ´ng cáº§n SM-2.
11. Táº¡o analytics service tĂ­nh overview, trend, weak words, review pressure vĂ  tag/level/quiz mode performance tá»« repositories.
12. Táº¡o AI module cĂ³ OpenAI Responses API client optional vĂ  rule-based fallback. Rate limit in-memory theo user/action.
13. Táº¡o `GlobalExceptionHandler` tráº£ `ApiError`, sync conflict 409 vĂ  AI rate limit 429.
14. Táº¡o `HealthCounterService` in-memory vĂ  endpoints `/api/health`, `/api/health/summary`.
15. Database production lĂ  PostgreSQL vá»›i `database/schema.sql`; local máº·c Ä‘á»‹nh H2 in-memory. Flyway migration cĂ³ sáºµn nhÆ°ng disabled máº·c Ä‘á»‹nh.
16. Backend Dockerfile multi-stage dĂ¹ng Eclipse Temurin 17, build jar báº±ng Maven Wrapper, runtime cháº¡y `java -Dserver.port=${PORT:-8080} -jar app.jar`.
17. Frontend config tá»± chá»n backend origin: local `http://localhost:8080`, production `https://quiz-app-xd9m.onrender.com`.
18. Test frontend báº±ng Playwright static server mock backend, test cĂ¡c flow load app, CRUD, sync, quiz, review, AI deck. Test backend báº±ng Spring Boot/JUnit cho spaced repetition, AI, rate limit, analytics, hardening, schema vĂ  health.

TĂ³m láº¡i, dá»± Ă¡n hiá»‡n lĂ  má»™t á»©ng dá»¥ng há»c tá»« vá»±ng local-first vá»›i backend session OAuth vĂ  Ä‘á»“ng bá»™ snapshot/revision. Äiá»ƒm quan trá»ng nháº¥t Ä‘á»ƒ giá»¯ giá»‘ng hĂ nh vi hiá»‡n táº¡i lĂ  duy trĂ¬ kháº£ nÄƒng cháº¡y offline/localStorage, sau Ä‘Ă³ má»›i sync cloud; giá»¯ fixed-interval review; giá»¯ contract API/DTO; vĂ  khĂ´ng thay Ä‘á»•i luá»“ng Google OAuth/session/CORS náº¿u khĂ´ng cĂ³ yĂªu cáº§u cá»¥ thá»ƒ.
