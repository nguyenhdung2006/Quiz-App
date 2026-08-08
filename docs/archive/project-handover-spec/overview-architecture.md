# Project Handover - Overview And Architecture

Historical split from $source lines 1-340. Content preserved for reference.

# TĂ i liá»‡u Ä‘áº·c táº£ vĂ  bĂ n giao dá»± Ă¡n Quiz App

NgĂ y láº­p: 2026-07-30  
Pháº¡m vi phĂ¢n tĂ­ch: toĂ n bá»™ source code, cáº¥u hĂ¬nh, database script, test, tĂ i liá»‡u vĂ  thÆ° má»¥c lÆ°u trá»¯ lá»‹ch sá»­ trong repository hiá»‡n táº¡i.  
NguyĂªn táº¯c: cĂ¡c nháº­n Ä‘á»‹nh dÆ°á»›i Ä‘Ă¢y dá»±a trĂªn mĂ£ nguá»“n vĂ  file trong repository. CĂ¡c file nhá»‹ phĂ¢n nhÆ° áº£nh, Ă¢m thanh, `.class`, `.jar`, `node_modules` Ä‘Æ°á»£c ghi nháº­n theo vai trĂ² vĂ  vá»‹ trĂ­, khĂ´ng giáº£i mĂ£ ná»™i dung nhá»‹ phĂ¢n.

## 1. Tá»•ng quan dá»± Ă¡n

### Má»¥c Ä‘Ă­ch dá»± Ă¡n

Quiz App, trong tĂ i liá»‡u vĂ  code cĂ²n dĂ¹ng tĂªn WordArena, lĂ  ná»n táº£ng há»c tá»« vá»±ng tiáº¿ng Anh cĂ³ quiz, Ă´n táº­p tá»« sai, thá»‘ng kĂª tiáº¿n Ä‘á»™, spaced repetition, Ä‘á»“ng bá»™ cloud khi Ä‘Äƒng nháº­p Google vĂ  fallback local-first khi chÆ°a Ä‘Äƒng nháº­p hoáº·c backend khĂ´ng kháº£ dá»¥ng.

### Chá»©c nÄƒng chĂ­nh

- Quáº£n lĂ½ tá»« vá»±ng: thĂªm, sá»­a, xĂ³a, lá»c, Ä‘Ă¡nh dáº¥u yĂªu thĂ­ch, Ä‘Ă¡nh dáº¥u Ä‘Ă£ thuá»™c hoáº·c khĂ³.
- Há»c vĂ  quiz: quiz theo chiá»u Anh sang Viá»‡t, Viá»‡t sang Anh, mixed, daily challenge, timed challenge, luyá»‡n tá»« sai vĂ  tá»« yĂªu thĂ­ch.
- Wrong bank: lÆ°u cĂ¡c tá»« tráº£ lá»i sai, cho phĂ©p luyá»‡n láº¡i vĂ  xĂ³a khá»i danh sĂ¡ch sai.
- Spaced repetition: tĂ­nh lá»‹ch Ă´n láº¡i dá»±a trĂªn streak vĂ  káº¿t quáº£ Ä‘Ăºng/sai.
- Analytics: tá»•ng quan há»c táº­p, xu hÆ°á»›ng Ä‘á»™ chĂ­nh xĂ¡c, Ă¡p lá»±c Ă´n táº­p, tá»« yáº¿u, hiá»‡u suáº¥t theo tag vĂ  quiz mode.
- Google OAuth2 login: xĂ¡c thá»±c báº±ng Google qua Spring Security OAuth2, session cookie `JSESSIONID`.
- Äá»“ng bá»™ dá»¯ liá»‡u cloud: snapshot, sync revision, hĂ ng Ä‘á»£i xĂ³a cloud cá»¥c bá»™ vĂ  guard chá»‘ng ghi Ä‘Ă¨ tá»« thiáº¿t bá»‹ cÅ©.
- AI há»— trá»£ há»c: giáº£i thĂ­ch cĂ¢u tráº£ lá»i sai vĂ  sinh deck tá»« Ä‘oáº¡n vÄƒn báº±ng OpenAI náº¿u cĂ³ API key, fallback rule-based náº¿u khĂ´ng cĂ³.
- Há»“ sÆ¡ ngÆ°á»i há»c: tĂªn, avatar, ngĂ y sinh, giá»›i tĂ­nh, má»¥c tiĂªu, bio, XP, level, streak, achievement.
- Import deck: starter words, curated decks, CSV import, AI generated decks.

### Äá»‘i tÆ°á»£ng sá»­ dá»¥ng

- NgÆ°á»i há»c tiáº¿ng Anh muá»‘n tá»± táº¡o kho tá»« vá»±ng vĂ  luyá»‡n táº­p.
- NgÆ°á»i há»c cáº§n á»©ng dá»¥ng cháº¡y Ä‘Æ°á»£c cáº£ khi chÆ°a Ä‘Äƒng nháº­p hoáº·c backend lá»—i.
- NgÆ°á»i há»c Ä‘Äƒng nháº­p Google Ä‘á»ƒ Ä‘á»“ng bá»™ tiáº¿n Ä‘á»™ giá»¯a trĂ¬nh duyá»‡t/thiáº¿t bá»‹.
- Admin backend cĂ³ role `ADMIN` Ä‘á»ƒ import sample words qua endpoint riĂªng.

### Kiáº¿n trĂºc tá»•ng thá»ƒ

```mermaid
flowchart LR
    User["User Browser"]
    Frontend["Static Frontend<br/>HTML/CSS/Vanilla JS"]
    LocalStorage["Browser localStorage"]
    Backend["Spring Boot REST API"]
    OAuth["Google OAuth2"]
    DB["H2 local hoáº·c PostgreSQL/Supabase"]
    OpenAI["OpenAI Responses API<br/>optional"]

    User --> Frontend
    Frontend <--> LocalStorage
    Frontend -->|fetch credentials include| Backend
    Backend -->|OAuth2 login| OAuth
    Backend -->|JPA repositories| DB
    Backend -->|optional API key| OpenAI
```

Frontend lĂ  static app, quáº£n lĂ½ nhiá»u state á»Ÿ global JavaScript vĂ  `localStorage`. Backend lĂ  Spring Boot layered architecture gá»“m controller, service, repository, entity/DTO. Database chĂ­nh thá»©c theo script PostgreSQL, nhÆ°ng local máº·c Ä‘á»‹nh dĂ¹ng H2 in-memory vá»›i Hibernate `ddl-auto=update`. Flyway migration cĂ³ sáºµn nhÆ°ng disabled máº·c Ä‘á»‹nh.

## 2. Cáº¥u trĂºc thÆ° má»¥c

### Root

| ÄÆ°á»ng dáº«n | Vai trĂ² |
|---|---|
| `README.md` | TĂ i liá»‡u giá»›i thiá»‡u, cĂ¡ch cháº¡y frontend/backend, OAuth, deploy, endpoint smoke check. |
| `AGENTS.md` | HÆ°á»›ng dáº«n cho agent khi lĂ m viá»‡c trong repo, gá»“m cáº¥u trĂºc, lá»‡nh test/build vĂ  quy táº¯c an toĂ n. |
| `.env.example` | Máº«u biáº¿n mĂ´i trÆ°á»ng root cho Google OAuth, database, frontend/backend URL, session cookie, OpenAI. |
| `.gitattributes` | Quy táº¯c Git attributes. |
| `.gitignore` | Loáº¡i trá»« dependency, build output, env, log, cache. |
| `package.json` | NPM metadata cho smoke test frontend báº±ng Playwright. |
| `package-lock.json` | Lockfile cho dependency Node. |
| `playwright.config.js` | Cáº¥u hĂ¬nh Playwright, static web server test á»Ÿ port 4173, project Chromium. |
| `target/` | Build output cá»¥c bá»™ cá»§a Maven á»Ÿ root, khĂ´ng pháº£i source runtime hiá»‡n táº¡i. |
| `node_modules/` | Dependency Node cá»¥c bá»™ theo `package-lock.json`. |
| `test-results/` | Káº¿t quáº£ test Playwright cá»¥c bá»™. |

### `frontend/`

| ÄÆ°á»ng dáº«n | Vai trĂ² |
|---|---|
| `frontend/index.html` | App shell chĂ­nh, chá»©a dashboard, vocabulary table, quiz screen, review screen, analytics, review today, learning studio overlay, modal profile, audio elements. |
| `frontend/login.html` | Trang Ä‘Äƒng nháº­p Google vĂ  landing/login flow. |
| `frontend/.vscode/settings.json` | Cáº¥u hĂ¬nh Live Server port `5501`. |
| `frontend/css/base.css` | Ná»n app, font cÆ¡ báº£n, utility `.hidden`. |
| `frontend/css/layout.css` | Layout legacy: container, form/table, quiz section. |
| `frontend/css/components.css` | Button, helper, review, mistakes, combo/effect legacy. |
| `frontend/css/typography.css` | Heading, title, stat typography legacy. |
| `frontend/css/quiz.css` | Giao diá»‡n quiz, lá»±a chá»n, progress, timer, challenge. |
| `frontend/css/effects.css` | Animation, particle, firework, shake. |
| `frontend/css/login.css` | Style trang login chĂ­nh. |
| `frontend/css/login-modern.css` | Style login modern, file tá»“n táº¡i nhÆ°ng `login.html` hiá»‡n chá»‰ load `login.css`. |
| `frontend/css/design-system.css` | Token vĂ  component system lá»›n, file tá»“n táº¡i nhÆ°ng `index.html` hiá»‡n khĂ´ng load trá»±c tiáº¿p. |
| `frontend/css/modern.css` | Style app shell hiá»‡n táº¡i, theme, dashboard, analytics, studio, profile, responsive. |
| `frontend/js/config.js` | XĂ¡c Ä‘á»‹nh backend API origin local/production, expose `window.QUIZ_APP_CONFIG`, `quizApiOrigin`, `quizIsProductionFrontend`. |
| `frontend/js/storage.js` | Account-scoped localStorage, guest/auth migration, `save`, `readLocalArray`, profile cache. |
| `frontend/js/vocab.js` | Model tá»« vá»±ng local, validate, normalize, CRUD, table render, filters, favorite/mastery/wrong bank local. |
| `frontend/js/ui.js` | Speech synthesis, home navigation, challenge menu, wrong-bank table. |
| `frontend/js/effects.js` | Combo UI, sounds, fireworks, screen shake. |
| `frontend/js/timer.js` | Hint timer vĂ  question timer. |
| `frontend/js/quiz.js` | Quiz engine, daily/timed challenge, answer flow, result/review screen, local word stats. |
| `frontend/js/ai-explain.js` | Client gá»i `/api/ai/explain-wrong-answer`, cooldown, fallback local, render explanation panel. |
| `frontend/js/challenge.js` | HĂ m `startChallenge(time)` cho timed challenge. |
| `frontend/js/main.js` | Khá»Ÿi táº¡o global state, DOM refs, keyboard handlers, mĂ n hĂ¬nh chĂ­nh. |
| `frontend/js/app.js` | Auth bootstrap, cloud sync, snapshot merge, delete queue, profile UI, dashboard, wrapped legacy functions. |
| `frontend/js/curated-decks.js` | 70 tá»« curated deck theo topic. |
| `frontend/js/learning-studio.js` | Overlay Learning Studio: profile/history/badges/focus/decks/AI deck/CSV. |
| `frontend/js/analytics-dashboard.js` | Gá»i analytics backend hoáº·c fallback local vĂ  render dashboard/canvas. |
| `frontend/js/review-today.js` | Review Today queue tá»« backend hoáº·c fallback local, answer flow. |
| `frontend/js/login.js` | OAuth login page behavior, tráº¡ng thĂ¡i query param, check `/api/me`, animation. |
| `frontend/js/theme.js` | Dark/light theme, localStorage theme, toggle labels. |
| `frontend/images/*` | áº¢nh UI, favicon, frame animation. |
| `frontend/sounds/*` | Ă‚m thanh combo quiz. |

Thá»© tá»± script trong `index.html` ráº¥t quan trá»ng: cĂ¡c file sau phá»¥ thuá»™c global tá»« file trÆ°á»›c. VĂ­ dá»¥ `app.js` dĂ¹ng vĂ  wrap cĂ¡c hĂ m tá»« `vocab.js`, `quiz.js`, `storage.js`.

### `backend/`

| ÄÆ°á»ng dáº«n | Vai trĂ² |
|---|---|
| `backend/pom.xml` | Maven project Spring Boot 3.5.14, Java 17, dependency backend. |
| `backend/mvnw`, `backend/mvnw.cmd`, `backend/.mvn/wrapper/*` | Maven Wrapper. |
| `backend/Dockerfile` | Multi-stage Docker build/runtime báº±ng Eclipse Temurin 17. |
| `backend/.env.example` | Máº«u biáº¿n mĂ´i trÆ°á»ng backend. |
| `backend/config/oauth2-google.example.yml` | Máº«u file OAuth Google ngoĂ i repo secret. |
| `backend/src/main/resources/application.yml` | OAuth, CORS, session cookie, frontend URL, AI config. |
| `backend/src/main/resources/application.properties` | App name, datasource, JPA, Flyway, actuator info/health. |
| `backend/src/main/resources/application-oauth.yml` | Cáº¥u hĂ¬nh OAuth profile bá»• sung, cĂ³ pháº§n trĂ¹ng vá»›i `application.yml`. |
| `backend/src/main/resources/db/migration/V1__baseline_schema.sql` | Migration baseline PostgreSQL. |
| `backend/src/main/resources/db/migration/V2__add_sync_revision.sql` | Migration thĂªm `sync_revision` cho `app_users`. |
| `backend/src/main/java/com/quizapp/QuizApplication.java` | Entry point Spring Boot. |
| `backend/src/main/java/com/quizapp/auth/*` | Auth/profile REST controller. |
| `backend/src/main/java/com/quizapp/config/*` | Security, CORS, AI properties, diagnostics, actuator info. |
| `backend/src/main/java/com/quizapp/user/*` | User entity, repository, profile DTO, current-user service. |
| `backend/src/main/java/com/quizapp/vocab/*` | Vocabulary, sync, quiz history, achievement entity/DTO/repository/service/controller. |
| `backend/src/main/java/com/quizapp/review/*` | Spaced repetition queue/answer controller/service/DTO. |
| `backend/src/main/java/com/quizapp/analytics/*` | Analytics controller/service/DTO/insight service. |
| `backend/src/main/java/com/quizapp/ai/*` | AI explanation/deck generation, OpenAI clients, fallback, rate limit, DTO/error. |
| `backend/src/main/java/com/quizapp/health/*` | Public health endpoints vĂ  in-memory counters. |
| `backend/src/main/java/com/quizapp/shared/*` | API error DTO vĂ  global exception handler. |
| `backend/src/test/java/com/quizapp/*` | Unit/integration tests backend. |

### `database/`

| ÄÆ°á»ng dáº«n | Vai trĂ² |
|---|---|
| `database/schema.sql` | Schema PostgreSQL Ä‘áº§y Ä‘á»§ vĂ  script sá»­a drift cá»™ng dá»“n: table, constraint, index, trigger, seed achievements. |

### `docs/`

Repo cĂ³ nhiá»u tĂ i liá»‡u hiá»‡n há»¯u:

- `docs/deploy.md`: hÆ°á»›ng dáº«n deploy Render/Vercel/Supabase, env, smoke test, Flyway rollout.
- `docs/backend-postgres.md`: cháº¡y backend H2/PostgreSQL vĂ  endpoint summary.
- `docs/oauth-google.md`: cáº¥u hĂ¬nh Google OAuth local/production.
- `docs/product.md`: mĂ´ táº£ sáº£n pháº©m vĂ  roadmap.
- `docs/schema-audit.md`, `docs/production-schema-drift-audit.md`: audit schema production/read-only queries.
- `docs/sync-hardening-audit.md`: audit Ä‘á»“ng bá»™ local/cloud.
- `docs/production-hardening-status.md`: tá»•ng há»£p hardening status. Má»™t sá»‘ Ä‘iá»ƒm trong file nĂ y lá»‡ch vá»›i source hiá»‡n táº¡i, vĂ­ dá»¥ health counter `syncFailures` khĂ´ng tá»“n táº¡i trong `HealthCounterService`.
- `docs/flyway-baseline-strategy.md`, `docs/flyway-baseline-rehearsal.md`: chiáº¿n lÆ°á»£c vĂ  rehearsal Flyway baseline.
- `docs/ui-before-after-checklist.md`, `docs/ui-video-comparison-plan.md`, `docs/ui-audit-evidence/`: Ä‘ang lĂ  untracked files trong working tree khi láº­p tĂ i liá»‡u nĂ y, khĂ´ng Ä‘Æ°á»£c thay Ä‘á»•i trong quĂ¡ trĂ¬nh phĂ¢n tĂ­ch.

### `tests/`

| ÄÆ°á»ng dáº«n | Vai trĂ² |
|---|---|
| `tests/static-server.mjs` | Static file server cho Playwright, phá»¥c vá»¥ repo á»Ÿ `http://127.0.0.1:4173/frontend/`. |
| `tests/smoke.spec.js` | Smoke tests frontend, mock backend, kiá»ƒm tra app load, onboarding, navigation, CRUD, sync conflict, delete queue, quiz, review queue, AI deck, curated decks. |

### `archive/`

`archive/phase1-20260513-013125/` chá»©a snapshot lá»‹ch sá»­ trÆ°á»›c phase 1:

- `README-before-phase1.md`.
- `frontend-duplicate-before-phase1-remaining/`: báº£n frontend cÅ© vĂ  má»™t sá»‘ scaffold backend lá»“ng bĂªn trong.
- `backend-generated-before-phase1-remaining/`: backend Spring cÅ© package `com.quiz`.
- `frotend-nested-spring-app/`: scaffold Spring lá»“ng trong thÆ° má»¥c bá»‹ typo.
- `root-target-before-phase1-remaining/`: compiled classes cÅ©.

ThÆ° má»¥c nĂ y khĂ´ng Ä‘Æ°á»£c load bá»Ÿi frontend/backend hiá»‡n táº¡i, nhÆ°ng dá»… lĂ m nhiá»…u khi tĂ¬m kiáº¿m vĂ¬ chá»©a source vĂ  binary cÅ©.

### Kiá»ƒm kĂª source file Ä‘Ă£ phĂ¢n tĂ­ch

CĂ¡c dependency/build artifact nhÆ° `node_modules/`, `target/`, `backend/target/` vĂ  file `.class` trong `archive/` Ä‘Æ°á»£c ghi nháº­n lĂ  artifact sinh ra hoáº·c dependency ngoĂ i, khĂ´ng coi lĂ  source nghiá»‡p vá»¥ hiá»‡n táº¡i. CĂ¡c source/config/test chĂ­nh dÆ°á»›i Ä‘Ă¢y Ä‘Ă£ Ä‘Æ°á»£c kiá»ƒm kĂª trong quĂ¡ trĂ¬nh láº­p tĂ i liá»‡u.

#### Backend main Java

| Package | File |
|---|---|
| `com.quizapp` | `QuizApplication.java` |
| `com.quizapp.auth` | `AuthController.java` |
| `com.quizapp.config` | `SecurityConfig.java` |
| `com.quizapp.health` | `HealthController.java`, `HealthCounterService.java`, `StartupDiagnosticsLogger.java`, `WordArenaInfoContributor.java` |
| `com.quizapp.shared` | `ApiError.java`, `GlobalExceptionHandler.java` |
| `com.quizapp.user` | `AppUser.java`, `AppUserRepository.java`, `CurrentUserService.java`, `ProfileDto.java`, `ProfileRequest.java` |
| `com.quizapp.vocab` | `Achievement.java`, `AchievementDto.java`, `AchievementRepository.java`, `AchievementService.java`, `LearningProgressService.java`, `ProgressSummaryDto.java`, `QuizAnswerRequest.java`, `QuizHistory.java`, `QuizHistoryAnswer.java`, `QuizHistoryDto.java`, `QuizHistoryRepository.java`, `QuizResultRequest.java`, `SyncConflictResponse.java`, `SyncRequest.java`, `SyncResponse.java`, `SyncRevisionConflictException.java`, `UserAchievement.java`, `UserAchievementId.java`, `UserAchievementRepository.java`, `VocabularyController.java`, `VocabularyRepository.java`, `VocabularyService.java`, `VocabularyWord.java`, `WordDto.java`, `WordRequest.java`, `WordStats.java`, `WordStatsDto.java`, `WrongBankEntry.java`, `WrongBankRepository.java` |
| `com.quizapp.review` | `ReviewAnswerRequest.java`, `ReviewAnswerResponse.java`, `ReviewController.java`, `ReviewQueueItemDto.java`, `SpacedRepetitionService.java` |
| `com.quizapp.analytics` | `AccuracyTrendDto.java`, `AnalyticsOverviewDto.java`, `LearningAnalyticsController.java`, `LearningAnalyticsService.java`, `LearningInsightDto.java`, `LearningInsightService.java`, `PerformanceMetricDto.java`, `ReviewPressureDto.java`, `TagPerformanceDto.java`, `WeakWordDto.java` |
| `com.quizapp.ai` | `AiDeckGeneratorClient.java`, `AiDeckGeneratorController.java`, `AiDeckGeneratorService.java`, `AiExplanationClient.java`, `AiExplanationController.java`, `AiExplanationService.java`, `AiJsonGuardrails.java`, `AiRateLimitAction.java`, `AiRateLimitError.java`, `AiRateLimitExceededException.java`, `AiRateLimitProperties.java`, `AiRateLimitService.java`, `ExplainWrongAnswerRequest.java`, `ExplainWrongAnswerResponse.java`, `GeneratedDeckResponse.java`, `GeneratedDeckWordDto.java`, `GenerateDeckRequest.java`, `OpenAiDeckGeneratorClient.java`, `OpenAiExplanationClient.java`, `RuleBasedDeckGeneratorService.java`, `RuleBasedExplanationService.java` |

#### Backend resource/test/build files

| NhĂ³m | File |
|---|---|
| Backend config/resource | `application.yml`, `application.properties`, `application-oauth.yml`, `db/migration/V1__baseline_schema.sql`, `db/migration/V2__add_sync_revision.sql` |
| Backend project/build | `pom.xml`, `Dockerfile`, `.env.example`, `config/oauth2-google.example.yml`, Maven Wrapper files |
| Backend tests | `AiDeckGeneratorFallbackTests.java`, `AiDeckGeneratorTests.java`, `AiExplanationFallbackTests.java`, `AiExplanationTests.java`, `AiRateLimitTests.java`, `BackendHardeningTests.java`, `DatabaseSchemaTests.java`, `HealthCheckTests.java`, `LearningAnalyticsTests.java`, `OpenAiClientGuardrailTests.java`, `QuizApplicationTests.java`, `SpacedRepetitionTests.java` |

#### Frontend, database, docs vĂ  tests

| NhĂ³m | File |
|---|---|
| Frontend HTML | `frontend/index.html`, `frontend/login.html` |
| Frontend CSS | `base.css`, `components.css`, `design-system.css`, `effects.css`, `layout.css`, `login.css`, `login-modern.css`, `modern.css`, `quiz.css`, `typography.css` |
| Frontend JS | `ai-explain.js`, `analytics-dashboard.js`, `app.js`, `challenge.js`, `config.js`, `curated-decks.js`, `effects.js`, `learning-studio.js`, `login.js`, `main.js`, `quiz.js`, `review-today.js`, `storage.js`, `theme.js`, `timer.js`, `ui.js`, `vocab.js` |
| Frontend assets | `images/quiz.jpg`, `icon.png`, `family.jpg`, `frame1.png` tá»›i `frame10.png`, favicon PNG/ICO/manifest, `sounds/combo_x1_x3_x5.mp3`, `combo_x10_x20_x30.mp3`, `combo_x50.mp3`, `combo_x100.mp3` |
| Database | `database/schema.sql` |
| Test frontend | `tests/static-server.mjs`, `tests/smoke.spec.js` |
| Existing docs | `backend-postgres.md`, `deploy.md`, `flyway-baseline-rehearsal.md`, `flyway-baseline-strategy.md`, `oauth-google.md`, `product.md`, `production-hardening-status.md`, `production-schema-drift-audit.md`, `schema-audit.md`, `sync-hardening-audit.md` |
| UI audit files hiá»‡n cĂ³ | `ui-before-after-checklist.md`, `ui-video-comparison-plan.md`, `ui-audit-evidence/*` |
| Archive source snapshot | CĂ¡c file dÆ°á»›i `archive/phase1-20260513-013125/` gá»“m backend cÅ© package `com.quiz`, frontend duplicate cÅ©, nested Spring app typo `frotend-nested-spring-app`, Maven wrapper/pom cÅ©, assets cÅ© vĂ  compiled classes cÅ©. |

## 3. CĂ´ng nghá»‡ sá»­ dá»¥ng

### NgĂ´n ngá»¯

| ThĂ nh pháº§n | NgĂ´n ngá»¯ |
|---|---|
| Frontend | HTML, CSS, JavaScript vanilla |
| Backend | Java 17 |
| Database | SQL PostgreSQL, H2 local compatibility |
| Test frontend | JavaScript Playwright |
| Build/runtime scripts | PowerShell/CMD wrapper, Dockerfile |

### Framework, library, dependency vĂ  version

Backend tá»« `backend/pom.xml`:

| Dependency | Version | Scope | Vai trĂ² |
|---|---:|---|---|
| Spring Boot parent | 3.5.14 | parent | Quáº£n lĂ½ version Spring stack. |
| Java | 17 | property | Runtime vĂ  compile target. |
| `spring-boot-starter-web` | theo Boot 3.5.14 | compile | REST API MVC. |
| `spring-boot-starter-data-jpa` | theo Boot 3.5.14 | compile | JPA/Hibernate repository/entity. |
| `spring-boot-starter-security` | theo Boot 3.5.14 | compile | Security filter chain/session auth. |
| `spring-boot-starter-oauth2-client` | theo Boot 3.5.14 | compile | Google OAuth2 client. |
| `spring-boot-starter-validation` | theo Boot 3.5.14 | compile | Jakarta Bean Validation cho DTO. |
| `spring-boot-starter-actuator` | theo Boot 3.5.14 | compile | Health/info endpoints. |
| `spring-boot-starter-thymeleaf` | theo Boot 3.5.14 | compile | CĂ³ trong dependency, khĂ´ng tháº¥y template runtime chĂ­nh trong source. |
| `thymeleaf-extras-springsecurity6` | theo Boot 3.5.14 | compile | CĂ³ trong dependency, chÆ°a tháº¥y dĂ¹ng trá»±c tiáº¿p. |
| `org.postgresql:postgresql` | theo Boot BOM | runtime | PostgreSQL driver. |
| `com.h2database:h2` | theo Boot BOM | runtime | Local in-memory DB. |
| `org.flywaydb:flyway-core` | theo Boot BOM | compile | Migration support. |
| `org.flywaydb:flyway-database-postgresql` | theo Boot BOM | runtime | Flyway PostgreSQL adapter. |
| `org.projectlombok:lombok` | theo Boot BOM | optional | CĂ³ dependency vĂ  annotation processor, source hiá»‡n chá»§ yáº¿u dĂ¹ng explicit code/record. |
| `spring-boot-devtools` | theo Boot BOM | runtime optional | Local development. |
| `spring-boot-starter-test` | theo Boot BOM | test | Backend tests. |
| `spring-security-test` | theo Boot BOM | test | Security tests. |

Frontend/test tá»« `package.json`:

| Dependency | Version | Vai trĂ² |
|---|---:|---|
| `@playwright/test` | `^1.60.0` | Frontend smoke tests. |

Build tool:

- Backend: Maven Wrapper (`backend/mvnw.cmd`, `backend/pom.xml`).
- Frontend: static files, khĂ´ng cĂ³ bundler. Playwright dĂ¹ng Node chá»‰ Ä‘á»ƒ test.
- Docker: `backend/Dockerfile`.
- Docker Compose: khĂ´ng tĂ¬m tháº¥y file `docker-compose.yml` hoáº·c tÆ°Æ¡ng Ä‘Æ°Æ¡ng trong repo.

Database:

- Local máº·c Ä‘á»‹nh: H2 in-memory `jdbc:h2:mem:quizapp;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE`.
- Production má»¥c tiĂªu: PostgreSQL/Supabase theo `database/schema.sql` vĂ  docs deploy.

## 4. Kiáº¿n trĂºc

### Backend architecture

Backend dĂ¹ng layered architecture theo Spring MVC:

```text
HTTP Request
-> Spring Security Filter Chain
-> Controller
-> CurrentUserService náº¿u endpoint cáº§n user hiá»‡n táº¡i
-> Service nghiá»‡p vá»¥
-> Repository Spring Data JPA
-> Entity/Hibernate
-> Database
```

KhĂ´ng tháº¥y Clean Architecture strict vá»›i use case port/adapter Ä‘á»™c láº­p. Code tá»• chá»©c theo module domain/package, má»—i module cĂ³ controller/service/repository/entity/DTO.

### MVC vĂ  REST

- Controller nháº­n request vĂ  tráº£ DTO/record/map.
- Service chá»©a business logic, transaction, sync, analytics, spaced repetition, AI fallback.
- Repository káº¿ thá»«a `JpaRepository`, chá»©a query method vĂ  má»™t sá»‘ JPQL.
- Entity Ă¡nh xáº¡ table báº±ng JPA annotation.

### Dependency Injection

ToĂ n bá»™ service/controller/config dĂ¹ng constructor injection:

- `VocabularyController` inject `VocabularyService`, `CurrentUserService`.
- `VocabularyService` inject repositories, `LearningProgressService`, `AchievementService`, `HealthCounterService`.
- `SecurityConfig` inject `AppProperties`.
- AI services inject client, fallback, rate limit, properties/counter.

Bean lifecycle:

- `QuizApplication.main` cháº¡y `SpringApplication.run`.
- Spring Boot auto-configures MVC, Security, JPA, Actuator.
- `StartupDiagnosticsLogger` láº¯ng nghe `ApplicationReadyEvent` vĂ  log tráº¡ng thĂ¡i cáº¥u hĂ¬nh.
- JPA entity lifecycle dĂ¹ng `@PrePersist`, `@PreUpdate` Ä‘á»ƒ set timestamp.

### Frontend architecture

Frontend lĂ  single-page static app khĂ´ng dĂ¹ng framework. State chĂ­nh náº±m trong biáº¿n global vĂ  `localStorage`.

```text
index.html
-> load CSS
-> load JS theo thá»© tá»± cá»‘ Ä‘á»‹nh
-> main.js táº¡o global DOM/state
-> vocab.js/quiz.js/ui.js Ä‘á»‹nh nghÄ©a hĂ m nghiá»‡p vá»¥ UI
-> app.js bootstrap auth/cloud sync vĂ  wrap cĂ¡c hĂ m legacy
-> analytics/review/studio module gáº¯n API vĂ o window
```

KhĂ´ng cĂ³ router framework. Routing ná»™i bá»™ lĂ  show/hide page qua `data-app-page` vĂ  `window.showAppPage`.

### Quan há»‡ giá»¯a cĂ¡c module backend

- `auth` phá»¥ thuá»™c `user`.
- `vocab` phá»¥ thuá»™c `user`, `health`.
- `review` phá»¥ thuá»™c `user`, `vocab`, `health`.
- `analytics` phá»¥ thuá»™c `vocab`, `user`, `health`.
- `ai` phá»¥ thuá»™c `user`, `config`, `health`.
- `shared` phá»¥ thuá»™c `health`.
- `config` phá»¥ thuá»™c `user` cho actuator info vĂ  security.

