# Technical Audit Report - Quiz App / WordArena

Ngày audit: 2026-07-30  
Vai trò audit: Staff Software Engineer / Tech Lead / Software Architect  
Phạm vi: repository hiện tại, gồm runtime source, config, database scripts, tests, CI, docs và archive. Các file nhị phân/assets được kiểm kê theo vai trò; không đánh giá nội dung nhị phân.

## Executive Summary

Dự án có nền tảng tốt cho một sản phẩm học từ vựng nhỏ/medium: backend Spring Boot theo layered architecture, có OAuth2 session auth, JPA entities rõ, validation DTO, global exception handler, Playwright smoke tests và backend hardening tests. Local-first UX là một lựa chọn sản phẩm hợp lý.

Tuy nhiên, nếu đưa production công khai, dự án chưa đạt chuẩn production-grade. Các blocker chính là: session API tắt CSRF, backend tin quá nhiều vào quiz/progress do client gửi, sync không có tombstone/per-field conflict, query xử lý in-memory, frontend monolith/global state lớn, migration production chưa mặc định an toàn, observability còn rất mỏng.

Kết luận production gate: **không nên release production quy mô lớn trước khi xử lý P0/P1 trong report này.** Với phạm vi beta cá nhân hoặc nhóm nhỏ, có thể chạy nếu đã cấu hình env đúng và chấp nhận rủi ro integrity/sync.

## 0. Methodology và phạm vi evidence

Đã kiểm kê source bằng `rg --files -uu` và đọc các file runtime/test/config quan trọng:

- Backend runtime: toàn bộ package `com.quizapp.*`, gồm `auth`, `config`, `user`, `vocab`, `review`, `analytics`, `ai`, `health`, `shared`.
- Frontend runtime: `frontend/index.html`, `login.html`, toàn bộ `frontend/js/*.js`, `frontend/css/*.css`.
- Database/config: `database/schema.sql`, Flyway migrations, `application.yml`, `application.properties`, `Dockerfile`, `.env.example`, `.gitignore`.
- Tests/CI: backend JUnit tests, Playwright smoke tests, `.github/workflows/ci.yml`.
- Archive/docs: đánh giá như artifact lịch sử, không coi là runtime active.

Line references dùng định dạng `path:line`.

## 1. Đánh giá kiến trúc

| Tiêu chí | Điểm | Nhận xét dựa trên source |
|---|---:|---|
| Architecture phù hợp | 7/10 | Backend layered architecture phù hợp app CRUD/quiz nhỏ: controller -> service -> repository. Ví dụ `VocabularyController` route vào service ở `backend/src/main/java/com/quizapp/vocab/VocabularyController.java:29-94`. Frontend static/local-first phù hợp MVP, nhưng không phù hợp scale maintainability dài hạn. |
| Layer rõ ràng | 7/10 | Backend layer khá rõ. DTO/entity/repository/service tách tương đối tốt. Điểm trừ: `CurrentUserService.requireUser` vừa auth mapping vừa ghi DB `lastActiveDate` ở mọi request `backend/src/main/java/com/quizapp/user/CurrentUserService.java:21-46`. |
| Dependency direction | 7/10 | Backend dependency chủ yếu đúng chiều. `shared` không phụ thuộc domain nặng ngoài exception DTO/counter. Frontend thì ngược: `app.js` wrap global function đã định nghĩa trước đó, phụ thuộc script order `frontend/js/app.js:1673-1709`. |
| Coupling | 5/10 | `frontend/js/app.js` 1,700+ dòng, phụ thuộc global `vocab`, `wrongWords`, `renderTable`, `finishQuiz`, `save`. `frontend/js/main.js:1-59` tạo nhiều global mutable state. Backend `VocabularyService` gom CRUD, sync, snapshot, quiz result, achievements. |
| Cohesion | 6/10 | Backend packages cohesive theo domain, nhưng `VocabularyService` làm quá nhiều vai trò: CRUD `:71-112`, sync `:127-159`, quiz result `:161-253`, snapshot `:255-281`, mapping/upsert `:330-377`. |
| SOLID | 6/10 | DI tốt, Repository pattern tốt. Single Responsibility bị vi phạm ở `VocabularyService` và `app.js`. Open/Closed yếu trong AI fallback/rate-limit config nhưng chấp nhận được. |
| DRY | 5/10 | Spaced repetition, stats, merge/normalize logic trùng frontend/backend: backend `SpacedRepetitionService.java:112-127`, frontend `vocab.js:77-83` và `recordWordResult` `vocab.js:193-217`. |
| KISS | 6/10 | Backend tương đối đơn giản. Sync client phức tạp: stale guard/delete queue/merge trong `app.js:98-337` và `:392-620`. |
| YAGNI | 5/10 | Có dependency/asset/code chưa rõ dùng: Thymeleaf/Lombok trong `pom.xml`, `design-system.css` không được load bởi `index.html`, archive chứa app cũ. |

## 2. Code Quality

### Điểm mạnh

- Naming backend rõ: `VocabularyService`, `LearningAnalyticsService`, `SpacedRepetitionService`, `CurrentUserService`.
- Constructor DI phổ biến và test-friendly.
- DTO validation có thông điệp cụ thể: `WordRequest.java:12-60`, `SyncRequest.java:14-18`, `QuizResultRequest.java:27-36`.
- Global exception format nhất quán qua `GlobalExceptionHandler.java:28-102`.
- Tests không ít: backend hardening tests bắt duplicate/admin/auth/CRUD ở `BackendHardeningTests.java:45-180`; smoke tests frontend bắt sync conflict/delete queue/stale device ở `tests/smoke.spec.js:380-641`.

### Findings

| Severity | Finding | Evidence | Impact | Cách sửa |
|---|---|---|---|---|
| High | Backend tin vào quiz metrics client gửi, có thể tự tăng XP/achievement | `QuizResultRequest` chỉ clamp numeric `backend/src/main/java/com/quizapp/vocab/QuizResultRequest.java:41-47`; `recordQuizResult` chỉ update word nếu tìm thấy `VocabularyService.java:178-222`, nhưng vẫn save history `:225`, tính XP từ `request.correctAnswers/total/maxCombo` `:227-230`, unlock achievements `:232-240`. | Authenticated user có thể POST fake quiz result để tăng XP/level/unlock achievement mà không cần answer hợp lệ. | Server phải tính `total/correct/wrong/maxCombo/score` từ `answers` đã match word; bỏ trust vào client totals. |
| High | Client sync có thể overwrite stats/mastery do backend nhận `stats` từ sync payload | `WordRequest` nhận `stats @Valid` `WordRequest.java:56-60`; `applyWordRequest` set trực tiếp seen/correct/wrong/streak/mastery/nextReview từ request `VocabularyService.java:367-375`. | User hoặc script có thể đặt mastery/stats tùy ý; nếu có leaderboard/gamification thì integrity sai. | Tách `WordCreateUpdateRequest` và `SyncImportRequest`; với sync chỉ accept server-safe fields hoặc audit source; stats chỉ cập nhật qua quiz/review endpoints. |
| High | Frontend monolith/God module | `frontend/js/app.js` chứa auth, sync, profile, import/export, dashboard, wrappers; line refs `app.js:1-39`, `:98-337`, `:482-620`, `:1214-1670`, `:1673-1709`. | Khó review, bug dễ lan, onboarding cho dev mới chậm. | Tách `auth.js`, `sync.js`, `profile.js`, `dashboard.js`, `import-export.js`; chuyển sang ES modules hoặc bundler. |
| Medium | Duplicate code/rules frontend-backend | Review interval backend `SpacedRepetitionService.java:112-127`; frontend `vocab.js:77-83`; stats update backend `VocabularyService.java:181-213`, frontend `vocab.js:193-217`. | Drift logic giữa local/offline và cloud, gây sync mismatch. | Đưa rules thành documented contract + contract tests; hoặc backend trả schedule policy; frontend chỉ display/apply local fallback theo versioned policy. |
| Medium | Long method / multi-responsibility | `VocabularyService.recordQuizResult` 90+ dòng `VocabularyService.java:161-253`; `syncCloudNow` nhiều nhánh `frontend/js/app.js:561-608`. | Khó test edge cases, transaction rộng. | Extract `QuizResultProcessor`, `SyncService`, `DeleteQueueService`. |
| Medium | Magic numbers rải rác | Frontend sync backoff/stale constants `app.js:6-11`; quiz/review intervals `vocab.js:77-83`; backend constants `SpacedRepetitionService.java:23`, `WordStatsDto.java:34-36`. | Khó điều chỉnh policy, thiếu central config. | Centralize learning/sync policy constants, expose config endpoint nếu cần. |
| Low | Logging prefix sai ngữ cảnh | `GlobalExceptionHandler` log validation/bad request/malformed với `[AUTH]` `GlobalExceptionHandler.java:30`, `:49`, `:58`. | Triage logs nhiễu. | Đổi prefix thành `[VALIDATION]`, `[REQUEST]`. |
| Low | `innerHTML` còn dùng với data không escape đầy đủ | `learning-studio.js:305` chèn `item.quizMode` từ history vào template; `review-today.js` có escape tốt ở `:536` và `:572-583`. | XSS chủ yếu self-XSS/localStorage, nhưng nên triệt tiêu. | Dùng `textContent`/DOM nodes cho mọi dynamic field. |

## 3. Design Pattern

### Pattern đang dùng đúng

- Dependency Injection: Spring constructor injection trong controllers/services, ví dụ `VocabularyController.java:24-27`, `LearningAnalyticsController.java:17-23`.
- Repository: Spring Data JPA repositories, ví dụ `VocabularyRepository` được service dùng ở `VocabularyService.java:20-25`.
- DTO/Mapper static factory: `WordDto.from` `WordDto.java:26-48`, `ProfileDto.from`.
- Facade-like service layer: controllers mỏng, service chứa nghiệp vụ.
- Adapter/Fallback cho AI: `AiExplanationService` gọi client hoặc fallback; OpenAI client implement interface.

### Pattern dùng chưa tốt hoặc thiếu

- Strategy bị thiếu cho spaced repetition: hiện hardcode fixed interval trong backend/frontend. Nên có `ReviewScheduleStrategy`.
- Mapper layer bị thiếu: mapping `WordRequest -> VocabularyWord` nằm trong `VocabularyService.applyWordRequest` `VocabularyService.java:342-377`.
- Specification/query pattern bị thiếu: filter due/tag/level đang stream in-memory `SpacedRepetitionService.java:48-55`.
- Command/Use-case service bị thiếu: `VocabularyService` nên tách thành command services.
- State machine thiếu cho sync: client sync state là object + flags thủ công `app.js:17-26`, dễ có invalid state.

Ví dụ refactor:

```java
interface ReviewScheduleStrategy {
    Instant nextReview(WordStats stats, boolean correct, Instant reviewedAt);
}

@Service
class FixedIntervalReviewSchedule implements ReviewScheduleStrategy { ... }
```

## 4. Business Logic Audit

### High: Quiz/progress integrity không đáng tin

Evidence:

- Request totals được clamp nhưng không verify với answers thực tế: `QuizResultRequest.java:41-47`.
- Service chỉ xử lý answer nếu word tồn tại `VocabularyService.java:178-222`.
- XP/achievement tính theo request raw numbers `VocabularyService.java:227-240`.

Impact:

- User authenticated có thể gửi `{totalQuestions:500, correctAnswers:500, score:10, maxCombo:500, answers:[] hoặc answers không match}` để nhận XP/achievement nếu validation cho phép answers list không null. Nếu answers empty, `QuizResultRequest` cho `@Size(max=500)` nhưng không `@Size(min=1)`.

Fix:

```java
int processedTotal = 0;
int processedCorrect = 0;
int maxCombo = computeComboFromProcessedAnswers(processed);
for (QuizAnswerRequest answer : request.answers()) {
    Optional<VocabularyWord> word = words.findByUserAndEngIgnoreCase(syncUser, answer.eng());
    if (word.isEmpty()) continue;
    processedTotal++;
    if (answer.correct()) processedCorrect++;
}
history.setTotalQuestions(processedTotal);
history.setCorrectAnswers(processedCorrect);
history.setWrongAnswers(processedTotal - processedCorrect);
int earnedXp = processedCorrect * 12 + processedTotal * 3 + maxCombo;
```

### High: Sync không có delete semantics server-side

Evidence:

- `/api/sync` nhận `vocab` và `wrongWords`, chỉ upsert `VocabularyService.java:135-152`.
- Client gửi sync payload chỉ có `vocab` và `wrongWords` `frontend/js/app.js:581-586`.
- Delete phụ thuộc queue riêng localStorage `app.js:281-337`; nếu queue mất hoặc thiết bị khác chưa biết delete, word có thể sống lại qua merge/upsert.

Fix:

- Thêm `deletedWordIds` hoặc tombstone table `word_tombstones(user_id, word_id, eng_key, deleted_at, revision)`.
- `sync` phải xử lý tombstone trước upsert và trả tombstone trong snapshot/delta.
- Không dùng absence trong list để suy luận delete nếu vẫn dùng snapshot full.

### Medium: `requireUser` ghi DB cho mọi request

Evidence: `CurrentUserService.requireUser` set `lastActiveDate` và `users.save(user)` ở mọi call `CurrentUserService.java:41-46`. Controllers gọi `requireUser` ở mọi endpoint `VocabularyController.java:30-93`, `ReviewController.java:30-49`, `LearningAnalyticsController.java:26-47`.

Impact:

- Read endpoints tạo write load/row lock pressure.
- Có thể gây update timestamp/revision confusion nếu sau này dùng updated_at user cho sync.

Fix:

- Tách `getCurrentUser(principal)` read-only và `touchLastActive(user)` rate-limited/background.
- Chỉ update `lastActiveDate` nếu ngày đổi và trong transaction riêng.

### Medium: Profile save frontend không gọi trực tiếp `/api/profile`

Evidence: frontend form submit chỉ `applyProfile(nextProfile)` `frontend/js/app.js:1345-1364`; cloud sync gửi profile trong `/api/sync` `app.js:581-586`. Backend có `PUT /api/profile` `AuthController.java:34-48`.

Impact: endpoint profile trực tiếp có thể bị ít dùng/test hơn; UX phụ thuộc sync availability.

Fix: gọi `PUT /api/profile` khi auth ready, fallback local sync nếu fail.

## 5. Database Audit

### Điểm mạnh

- Core schema normalized tốt: users, vocabulary, stats, wrong bank, quiz history, achievements.
- FK cascade hợp lý: `vocabulary.user_id` cascade `database/schema.sql:31`, `word_stats.word_id` cascade `:57`, wrong bank FKs `:76-77`.
- Check constraints cơ bản: role/xp/streak `database/schema.sql:22-26`, word not blank `:51-52`, stats non-negative/mastery `:68-71`, quiz score `:95-99`.
- Index có ý thức: user, lower eng, tag, next review, history `database/schema.sql:188-194`.

### Findings

| Severity | Finding | Evidence | Cách sửa |
|---|---|---|---|
| High | Production migration mặc định chưa an toàn | `ddl-auto=update` default `application.properties:9`; Flyway disabled default `:14`. V1 baseline thiếu `sync_revision` `V1__baseline_schema.sql:1-29`, V2 thêm sau `V2__add_sync_revision.sql:1-2`. | Production env bắt buộc `JPA_DDL_AUTO=validate`, `FLYWAY_ENABLED=true` sau baseline; add CI check fail nếu prod profile dùng `update`. |
| Medium | Unique constraint không khớp duplicate rule normalized | DB unique `(user_id, eng)` `database/schema.sql:50`; app duplicate check normalize trim/lower/space bằng stream `VocabularyService.java:389-397`. | Thêm unique index `(user_id, lower(btrim(regexp_replace(eng,'\s+',' ','g'))))` hoặc generated column `eng_key`. |
| Medium | Query không tận dụng index cho review/analytics | Review queue load all words rồi filter `SpacedRepetitionService.java:48-55`; analytics load all words/histories `LearningAnalyticsService.java:168-174`. | Thêm repository queries theo due/tag/level/pagination; aggregate query cho analytics. |
| Low | Legacy columns không map entity | `username`, `password_hash` tồn tại `database/schema.sql:3-5`; OAuth flow không dùng password. | Nếu không cần, migration drop sau audit dữ liệu; hoặc document là legacy. |

N+1 risk:

- `listWrongWords` map entry -> word `VocabularyService.java:65-68` với lazy `WrongBankEntry.word`; nếu collection lớn, có thể N+1. Fix bằng `@EntityGraph` hoặc query join fetch.

## 6. API Audit

### RESTfulness/status

- CRUD routes hợp lý: `/api/vocab`, `/api/vocab/{id}` `VocabularyController.java:29-50`.
- `POST /api/vocab` trả default 200 thay vì 201; `DELETE` void default thường 200 thay vì 204 `VocabularyController.java:34-50`.
- Read endpoints trả raw arrays, không envelope/pagination: vocab `:29-31`, wrong words `:53-55`, review queue `ReviewController.java:34-41`, analytics weak words `LearningAnalyticsController.java:35-37`.

### Validation

- DTO validation tốt ở basic fields: `WordRequest.java:12-60`, `SyncRequest.java:14-18`.
- Thiếu semantic validation:
  - `QuizResultRequest.answers` không min size `QuizResultRequest.java:34-36`.
  - `SyncRequest.expectedRevision` nullable `SyncRequest.java:9`; service reject null với 409 `VocabularyService.java:291-297`, acceptable nhưng API contract nên rõ.
  - `level`, `pos`, `tag` mostly free-form; frontend có option list nhưng backend không enforce.

### Versioning/OpenAPI

- Không có `/api/v1`.
- Không thấy Swagger/OpenAPI dependency/config.
- Response format không nhất quán: public `/api/me` unauth trả `Map`, errors trả `ApiError`, sync conflict trả `SyncConflictResponse`, AI rate-limit trả `AiRateLimitError`.

Fix:

- Thêm OpenAPI spec, response envelope hoặc documented error schema.
- Pagination cho `GET /api/vocab`, `GET /api/quiz-history`, analytics list endpoints.
- Status code explicit:
  - create: `201 Created`
  - delete: `204 No Content`
  - not found: `404`, không chỉ 400 `"Word not found."`.

## 7. Security Audit

| Severity | Area | Finding | Evidence | Fix |
|---|---|---|---|---|
| High | CSRF/session | CSRF disabled while API uses cookie session and credentialed CORS | `SecurityConfig.java:47`; cookie config `application.yml:27-33`; CORS credentials true `SecurityConfig.java:91-97`. | Enable CSRF token for state-changing APIs or use SameSite Lax/Strict for same-site only. For cross-site Vercel/Render, expose CSRF token endpoint and send `X-CSRF-TOKEN`. |
| High | Authorization/business integrity | Authenticated user can forge quiz XP/progress | `VocabularyService.java:227-240`, `QuizResultRequest.java:41-47`. | Compute progress server-side from verified answers; cap daily XP; audit abnormal scores. |
| Medium | Rate limit | AI rate limit is in-memory per JVM | `AiRateLimitService.java:21-23`; cleanup local `:86-93`. | Use Redis/db-backed rate limiter for multi-instance; include IP/user dimensions. |
| Medium | CORS | Allowed headers wildcard with credentials | `SecurityConfig.java:95-97`. | Restrict headers to `Content-Type`, `X-CSRF-TOKEN`; validate env origins no wildcard. |
| Medium | Security headers | No explicit CSP/HSTS/referrer policy in source | `SecurityConfig.java:45-85` configures CORS/CSRF/OAuth/logout only. | Add `headers` config and frontend CSP. Do not rely only on hosting defaults. |
| Medium | Stored large avatar/data URL | Frontend reads arbitrary image as DataURL `app.js:1327-1342`; backend avatar max 100000 `ProfileRequest` via `/api/profile`. | DB bloat and potential SVG/script/data URL risk if rendered. | Restrict avatar to trusted HTTPS URLs or upload pipeline; reject SVG/data URLs server-side. |
| Low | Secrets | `.env` and `backend/.env` exist locally but are ignored | `.gitignore:40-46`; `git check-ignore` shows `.env` and `backend/.env` ignored. | Keep ignored, never commit; add secret scanning in CI. |
| Low | SQL injection | Repository/JPA methods used; no raw SQL in runtime Java found. | Repositories/JPA usage in services. | Continue avoiding string-built SQL. |
| Low | XSS | Most dynamic UI uses `textContent`; one unescaped `innerHTML` history row remains | `learning-studio.js:305`; safe counterexample `review-today.js:572-583`. | Replace with DOM nodes/textContent. |
| N/A | JWT/password | No JWT/password login in runtime. `password_hash` is DB legacy only. | `database/schema.sql:5`; OAuth in `SecurityConfig`. | Remove legacy password columns if unused. |
| N/A | File upload/RCE/command injection | No server file upload/command execution endpoints found. | Runtime backend controllers. | Maintain this boundary. |

OWASP mapping:

- A01 Broken Access Control: no direct cross-user access due `findByIdAndUser`, but business integrity issue in quiz result.
- A05 Security Misconfiguration: CSRF disabled, migration defaults, no explicit security headers.
- A07 Identification/Auth Failures: OAuth session ok, but CSRF/session hardening incomplete.
- A08 Software/Data Integrity: client-trusted quiz/sync stats.

## 8. Performance Audit

### Main bottlenecks

| Scale trigger | Evidence | Impact |
|---|---|---|
| Large vocab per user | duplicate lookup loads all user words `VocabularyService.java:389-397`; create also counts all words `:81`. | O(n) per create/update; slow at 10k+ words. |
| Review queue | all user words stream/filter/sort `SpacedRepetitionService.java:48-55`. | O(n log n) and memory allocation per request. |
| Analytics overview | calls `userWords`, `histories`, `reviewPressure`, `accuracyTrend`, `tagPerformance`; each may reload data `LearningAnalyticsService.java:50-54`, `:168-174`. | Repeated DB hits and in-memory aggregation. |
| Snapshot | snapshot calls `listWords`, `listWrongWords`, `progress` `VocabularyService.java:263-270`; progress itself queries words/history. | Heavy full snapshot for every sync/progress/achievement/history endpoint. |
| Frontend DOM | `renderTable` clears and rebuilds table `vocab.js:695-724`; no virtualization. | UI jank for large word sets. |

### Caching/batch/concurrency

- No server cache layer.
- No async processing for AI calls; Java HttpClient call is blocking `OpenAiExplanationClient.java:68`.
- No JDBC batch config seen.
- Pessimistic user lock protects sync revision `AppUserRepository.findByIdForSyncUpdate`, but can serialize all writes per user.

Fix priority:

1. Repository queries for due review and duplicate by generated `eng_key`.
2. Pagination/delta sync.
3. Materialized/aggregated analytics summary or scheduled aggregate.
4. Frontend table virtualization.

## 9. Error Handling

Strengths:

- Global handler maps validation, illegal argument, malformed JSON, access denied, sync conflict, AI rate limit, runtime `GlobalExceptionHandler.java:28-102`.
- AI client has timeout and catches IO/interrupted `OpenAiExplanationClient.java:61-83`.
- Frontend retries `/api/me` transient failure `app.js:1039-1055`.
- Frontend handles sync conflict by pulling snapshot `app.js:589-594`.

Gaps:

- Runtime 500 hides detail from client, good, but logs full exception; acceptable.
- No circuit breaker for OpenAI; fallback catches runtime in service, but every request can still try OpenAI if configured.
- Health counters are in-memory only and reset on restart `HealthCounterService.java:12-20`.
- `requestJson` silently returns null on non-OK/error `app.js:623-638`, making UI/debug inconsistent.
- No standardized machine-readable error code except sync conflict and AI rate limit.

## 10. Testing Audit

### Existing coverage

- Backend hardening tests cover validation, duplicate normalized English, admin denial, `/api/me`, CRUD `BackendHardeningTests.java:45-180`.
- Tests include concurrency/hardening later in same file; file length 622 lines indicates broad backend regression suite.
- Playwright smoke tests cover app load/navigation/local CRUD/sync conflict/stale device/delete queue/quiz/review/AI deck/curated deck `tests/smoke.spec.js:244-814`.
- CI runs backend tests, JS syntax check, npm ci, Playwright Chromium smoke tests `.github/workflows/ci.yml:23-65`.

### Missing tests

- Security tests for CSRF behavior are absent because CSRF disabled.
- No tests proving server recomputes quiz XP; current implementation trusts client.
- No load/performance tests for 5k vocab sync limit.
- No API contract/OpenAPI schema tests.
- No accessibility tests despite rich frontend.
- No multi-instance tests for AI rate limit or sync race across app nodes.
- No tests for profile `PUT /api/profile` usage from frontend.

## 11. DevOps Audit

Strengths:

- GitHub Actions CI exists and runs backend + frontend checks `.github/workflows/ci.yml:1-65`.
- Dockerfile is simple multi-stage Java 17 build `backend/Dockerfile:1-18`.
- Playwright config uses static server and trace on retry `playwright.config.js:4-25`.
- `.gitignore` protects `.env`, OAuth config and local secrets `.gitignore:40-46`.

Gaps:

- Dockerfile skips tests during image build `backend/Dockerfile:10`; CI covers tests, but direct image build can ship untested code.
- No Docker Compose found for local prod-like DB/backend/frontend.
- No deploy workflow/rollback automation in `.github/workflows`.
- No secret scanning job in CI.
- No image vulnerability scanning.
- No metrics backend beyond actuator health/info and in-memory counters.
- `.github/java-upgrade` and `.github/modernize/java-upgrade` hook scripts duplicate logic and write JSON based on simple string parsing `.github/java-upgrade/hooks/scripts/recordToolUse.sh:4-27`.

## 12. Frontend Audit

| Area | Điểm | Evidence / nhận xét |
|---|---:|---|
| Component structure | 3/10 | Không có component system thực sự; DOM manipulation thủ công. `app.js` và `learning-studio.js` quá lớn. |
| State management | 4/10 | Global mutable vars in `main.js:1-59`; account localStorage in `storage.js`; sync state in `app.js:17-26`. Không có state machine formal. |
| Routing | 6/10 | Internal page switching via `showAppPage` `app.js:1066-1094`; đủ cho SPA nhỏ. |
| Responsive | 6/10 | CSS lớn `modern.css` 4,700+ lines, likely nhiều responsive rules; chưa audit visual trong report này. |
| Accessibility | 5/10 | Có vài `aria-label`/progressbar ở review `review-today.js:321-345`; chưa có automated a11y tests. |
| Performance | 4/10 | Re-render full table/sections with `innerHTML=""`, no virtualization. |
| SEO | 3/10 | Static app behind login/local-first; SEO không phải mục tiêu rõ. Login page có landing content. |

Frontend refactor targets:

- `frontend/js/app.js`
- `frontend/js/learning-studio.js`
- `frontend/js/vocab.js`
- `frontend/js/main.js`
- `frontend/css/modern.css`

## 13. Khả năng mở rộng

| Quy mô | Dự báo |
|---|---|
| 100 users | Chạy ổn nếu single instance, H2 local không dùng production, PostgreSQL cấu hình đúng. Rủi ro chính là sync edge cases và CSRF/security. |
| 10,000 users | DB cần PostgreSQL production, indexes tốt hơn. In-memory AI rate limit không đủ nếu scale multi-instance. Analytics/review full-scan per user bắt đầu gây chậm với power users. |
| 100,000 users | Cần pagination/delta sync, aggregate analytics, Redis/rate limiter, metrics/tracing, CDN/static hosting, connection pool tuning. Full snapshot `/api/sync` và `/api/snapshot` sẽ tốn bandwidth/CPU. |
| 1 million users | Kiến trúc hiện tại chưa phù hợp. Cần event-driven stats, async jobs, service-level SLO, distributed cache, sharding/partition strategy hoặc managed scale, robust conflict resolution. |

Điểm yếu scale chính: full-list sync, in-memory analytics, in-memory rate limit/counters, frontend localStorage payload lớn, không pagination.

## 14. Khả năng bảo trì

Gây khó hiểu cho dev mới:

- `app.js` wrap global functions sau khi init `app.js:1673-1709`; behavior thật không nằm ở file gốc.
- `VocabularyService` làm nhiều use case production-critical.
- Sync semantics nằm cả backend `VocabularyService.sync` và frontend `app.js`.
- Archive chứa app cũ package `com.quiz`, dễ nhầm với runtime `com.quizapp`.
- Config OAuth bị duplicate giữa `application.yml` và `application-oauth.yml`.

Nên refactor/chia nhỏ:

- Rewrite/partition: `frontend/js/app.js`, `frontend/js/learning-studio.js`.
- Split service: `VocabularyService` thành `VocabularyCrudService`, `SyncService`, `QuizResultService`, `SnapshotService`.
- Extract: `ReviewSchedulePolicy`, `WordMapper`, `ProfileService`, `AnalyticsQueryService`.

## 15. Technical Debt Inventory

### Architecture smells

- Frontend global mutable state and monkey patching.
- Backend service with multiple responsibilities.
- Sync is implicit protocol, not a formal state machine or versioned contract.

### Security smells

- CSRF disabled with cookie auth.
- Client-trusted XP/stats.
- In-memory rate limit.
- No explicit CSP/security headers.

### Performance smells

- Full table/list rendering.
- Full user word scans for duplicate/review/analytics.
- Full snapshot sync.
- No batch writes.

### Design/code smells

- Duplicated learning policy frontend/backend.
- Magic numbers for review/sync/backoff.
- Unused/unclear dependencies/assets.
- `innerHTML` dynamic field in `learning-studio`.
- `GlobalExceptionHandler` log prefixes misleading.

### DevOps smells

- Flyway disabled by default.
- Docker build skips tests.
- No secret/image scan.
- No deployment pipeline.
- In-memory counters only.

## 16. Refactor Plan

### P0 - bắt buộc trước production

| Mục | Lý do | File liên quan | Ảnh hưởng | Cách sửa | Lợi ích |
|---|---|---|---|---|---|
| Server recompute quiz result/XP | Ngăn fake XP/achievement | `QuizResultRequest.java`, `VocabularyService.java:161-253` | Backend API/logic | Ignore client totals for XP; compute from matched answers; add tests for forged payload. | Integrity gamification. |
| CSRF protection/session hardening | Cookie session + CSRF disabled là rủi ro web | `SecurityConfig.java:47`, `application.yml:27-33` | Backend + frontend fetch | Add CSRF token endpoint/header or redesign auth token. Add security tests. | Giảm CSRF account action risk. |
| Production DB migration policy | `ddl-auto=update` default không production-safe | `application.properties:9-20`, migrations | Deploy config | Prod profile `validate`; Flyway enabled after baseline; CI/deploy guard. | Tránh drift/incident schema. |
| Sync tombstone/delete contract | Ngăn delete resurrection/lost update | `VocabularyService.sync`, `app.js:281-337`, `app.js:581-586` | API + DB + frontend | Add tombstone table/payload; delta sync tests. | Data consistency multi-device. |

### P1

| Mục | Lý do | File liên quan | Cách sửa | Lợi ích |
|---|---|---|---|---|
| Split `VocabularyService` | God service | `VocabularyService.java` | Extract CRUD/sync/quiz/snapshot services. | Testability, maintainability. |
| Replace in-memory scans | Scale bottleneck | `VocabularyService.java:389-397`, `SpacedRepetitionService.java:48-55`, `LearningAnalyticsService.java:168-174` | Repository queries, generated `eng_key`, pagination. | Performance. |
| Distributed rate limit | Multi-instance correctness | `AiRateLimitService.java:21-23` | Redis/token bucket. | Abuse control. |
| API pagination/versioning/OpenAPI | Contract maturity | Controllers | Add `/api/v1`, page params, OpenAPI. | Client stability. |

### P2

| Mục | Lý do | File liên quan | Cách sửa | Lợi ích |
|---|---|---|---|---|
| Frontend module migration | Global coupling | `app.js`, `main.js`, `learning-studio.js` | ES modules or framework; explicit imports. | Safer changes. |
| Central learning policy | DRY | `SpacedRepetitionService`, `vocab.js`, `review-today.js` | Shared policy doc/endpoint/contract tests. | Consistent local/cloud. |
| Observability | Debug production | `HealthCounterService`, `HealthController` | Micrometer metrics, structured logs, trace id. | Operability. |
| XSS cleanup | Defense-in-depth | `learning-studio.js:305` | DOM APIs/textContent. | Security hygiene. |

### P3

| Mục | Lý do | File liên quan | Cách sửa | Lợi ích |
|---|---|---|---|---|
| Remove/segregate archive | Avoid search noise | `archive/` | Move to separate branch/release artifact or document clearly. | Faster onboarding. |
| Remove unused deps/assets | Reduce noise | `pom.xml`, CSS files | Confirm usage then remove Thymeleaf/Lombok or unused CSS. | Smaller surface. |
| Add Docker Compose | Local prod parity | root | Compose PostgreSQL + backend + static frontend. | Easier onboarding. |

## 17. Production Readiness Scorecard

| Area | Score |
|---|---:|
| Architecture | 6.5/10 |
| Maintainability | 5.5/10 |
| Readability | 6.5/10 |
| Scalability | 4/10 |
| Performance | 5/10 |
| Security | 4/10 |
| Reliability | 5.5/10 |
| Testing | 7/10 |
| Documentation | 8/10 |
| Deployment | 6/10 |
| Monitoring | 3/10 |
| Code Quality | 6/10 |
| Business Logic | 5/10 |
| Database | 6/10 |
| API Design | 5/10 |

Production readiness average: **5.6/10**.

## 18. Senior Engineer Report

### Điểm mạnh

- Backend package/domain organization tốt cho quy mô hiện tại.
- OAuth2/session integration rõ; endpoint `/api/me` hỗ trợ bootstrap local/prod.
- Validation/error handling tốt hơn mức MVP.
- Sync hardening client có nhiều guard thực tế: pull-before-push, revision conflict, stale device, delete queue.
- Tests đáng kể, có CI chạy backend + frontend checks.
- Docs deployment/schema/sync khá đầy đủ.

### Điểm yếu

- Business integrity chưa production-safe vì backend tin client về quiz/progress.
- CSRF disabled với session cookie.
- Sync chưa có conflict/delete model đủ mạnh.
- Frontend quá monolithic/global.
- Query/list/snapshot chưa scale.
- Monitoring/rate-limit chưa distributed.

### Lỗi nghiêm trọng nhất

1. Fake XP/achievement qua `/api/quiz-results`.
2. CSRF disabled với cookie session.
3. Delete/sync không có tombstone contract.
4. Production schema/migration phụ thuộc env discipline.

### Bắt buộc sửa trước production

- P0 trong section 16.
- Thêm tests chứng minh forged quiz payload không thể tăng XP.
- Bật/cấu hình CSRF hoặc đổi auth model.
- Thiết lập prod profile `JPA_DDL_AUTO=validate`, Flyway rollout chuẩn.

### Nên cải thiện sau

- Split frontend/backend services.
- Add OpenAPI/pagination.
- Add observability metrics/tracing.
- Replace in-memory analytics/review query.

### Ước lượng chất lượng lập trình viên

Dựa trên code, đây không phải code Junior thuần. Backend có dấu hiệu **Middle-to-Senior**: biết dùng Spring Security, JPA, validation, tests, CI, sync hardening. Frontend lại mang dấu hiệu **Middle/MVP evolution**: global state, large files, manual DOM, monkey patching. Tổng thể đội/người viết đang ở mức **Middle+**, có một số quyết định Senior-ish ở hardening/tests nhưng chưa nhất quán ở architecture và production security.

### Điểm tổng thể

**64/100** cho production readiness hiện tại.

Diễn giải: tốt cho beta/local-first và có nền để nâng cấp; chưa đạt chuẩn production public scale vì integrity/security/sync/observability vẫn còn blocker.
