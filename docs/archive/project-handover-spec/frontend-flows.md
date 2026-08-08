# Project Handover - Frontend And Flows

Historical split from $source lines 1271-1622. Content preserved for reference.

## 9. Authentication & Authorization

### CÆ¡ cháº¿

- Backend dĂ¹ng Spring Security OAuth2 Client vá»›i Google.
- Session auth báº±ng `JSESSIONID`.
- KhĂ´ng cĂ³ JWT trong source hiá»‡n táº¡i.
- CSRF disabled.
- CORS cho phĂ©p credentials vĂ  origin theo `app.frontend.origin`.

### Security flow

```text
Frontend login button
-> redirect backend /oauth2/authorization/google
-> Google consent/account chooser
-> callback /login/oauth2/code/google
-> Spring Security táº¡o session
-> redirect vá» app.frontend.success-redirect-uri
-> frontend gá»i /api/me vá»›i credentials include
-> backend CurrentUserService táº¡o hoáº·c cáº­p nháº­t AppUser
```

### Public endpoints

- `OPTIONS /**`
- `/oauth2/**`
- `/login/oauth2/**`
- `/api/health/**`
- `/actuator/health`
- `/actuator/info`
- `/api/me`
- `/error`

### Protected endpoints

Má»i endpoint cĂ²n láº¡i cáº§n authenticated session. Náº¿u chÆ°a authenticated, `AuthenticationEntryPoint` redirect tá»›i `/oauth2/authorization/google`.

### Authorization

- KhĂ´ng cĂ³ role hierarchy hoáº·c permission table.
- Endpoint `/api/admin/sample-words` gá»i `CurrentUserService.requireAdmin`, chá»‰ cho user cĂ³ `role=ADMIN`.

### Logout

Spring Security logout:

- URL máº·c Ä‘á»‹nh `/logout`.
- Invalidate session.
- Delete cookie `JSESSIONID`.
- Redirect tá»›i `app.oauth2.logout-redirect-uri`.

## 10. Frontend

### Trang

- `login.html`: login/landing page.
- `index.html`: SPA chĂ­nh.

### App sections trong `index.html`

- Dashboard.
- Vocabulary.
- Review Today.
- AI Deck.
- Analytics.
- Learning Studio overlay.
- Quiz screen.
- Result screen.
- Review answer screen.
- Mistake screen.
- Profile editor modal.
- Product preview modal.

### Component/UI blocks

KhĂ´ng cĂ³ component framework, nhÆ°ng cĂ³ DOM blocks:

- Sidebar navigation vá»›i `data-target-page`.
- Topbar profile/auth/sync status.
- Vocabulary form vĂ  table.
- Filter toolbar.
- Practice actions.
- Quiz choice buttons.
- Analytics cards vĂ  canvas chart.
- Review queue cards.
- Learning Studio tab panel.
- Curated/AI deck cards.
- CSV import controls.

### Routing

- KhĂ´ng dĂ¹ng browser router.
- Internal navigation qua `window.showAppPage(page)` vĂ  `data-app-page`.
- `goHome()` gá»i `showAppPage("dashboard")` náº¿u cĂ³.

### State Management

- Global variables trong `main.js`: `vocab`, `wrongWords`, quiz state.
- Account-scoped `localStorage` trong `storage.js`.
- `app.js` giá»¯ cloud sync state riĂªng.
- CĂ¡c module expose object lĂªn `window`: `quizCloud`, `analyticsDashboard`, `reviewToday`, `aiExplainWrongAnswer`, `WORD_ARENA_CURATED_DECKS`.

### API gá»i backend

| Frontend file | API |
|---|---|
| `login.js` | `GET /api/me`, redirect `/oauth2/authorization/google` |
| `app.js` | `/api/me`, `/api/snapshot`, `/api/sync`, `/api/vocab`, `/api/vocab/{id}`, `/api/admin/sample-words`, `/api/quiz-results`, `/logout` |
| `review-today.js` | `/api/review/queue`, `/api/review/answer` |
| `analytics-dashboard.js` | `/api/analytics/*` |
| `ai-explain.js` | `/api/ai/explain-wrong-answer` |
| `learning-studio.js` | `/api/ai/generate-deck` |

### UI Flow chĂ­nh

- Local-first: user cĂ³ thá»ƒ thĂªm tá»«, quiz, review báº±ng localStorage mĂ  khĂ´ng cáº§n backend.
- Khi Ä‘Äƒng nháº­p: app pull snapshot cloud trÆ°á»›c khi push Ä‘á»ƒ trĂ¡nh máº¥t dá»¯ liá»‡u cloud.
- Khi backend lá»—i: UI hiá»ƒn thá»‹ sync status vĂ  fallback local cho analytics/review.
- Khi production frontend chÆ°a Ä‘Äƒng nháº­p: `app.js` redirect sang login.

## 11. Luá»“ng hoáº¡t Ä‘á»™ng

### ÄÄƒng nháº­p

1. User má»Ÿ `login.html`.
2. `login.js` gá»i `/api/me`.
3. Náº¿u chÆ°a authenticated, click Google login redirect tá»›i backend `/oauth2/authorization/google`.
4. Backend chuyá»ƒn sang Google OAuth.
5. Google callback vá» `/login/oauth2/code/google`.
6. Spring Security táº¡o session.
7. Backend redirect tá»›i `index.html`.
8. `app.js` gá»i `/api/me`, táº¡o/cáº­p nháº­t user qua `CurrentUserService`.
9. Frontend switch account storage, pull snapshot vĂ  sync.

### Cáº­p nháº­t há»“ sÆ¡

1. User má»Ÿ profile editor trong app.
2. Frontend cáº­p nháº­t local profile.
3. Cloud sync gá»­i `profile` trong `/api/sync`.
4. Backend `VocabularyService.applyProfileRequest` cáº­p nháº­t user vĂ  tÄƒng revision.
5. Endpoint trá»±c tiáº¿p `PUT /api/profile` cÅ©ng tá»“n táº¡i vĂ  cáº­p nháº­t profile transactional.

### Táº¡o tá»« vá»±ng

1. User nháº­p form trong Vocabulary.
2. `vocab.js` validate required/duplicate/max English length.
3. ThĂªm vĂ o local `vocab`, `save()`, render UI.
4. Náº¿u `window.quizCloud.createWord` sáºµn sĂ ng, frontend gá»i `POST /api/vocab`.
5. Backend lock user, check duplicate, save word, unlock `FIRST_WORD` náº¿u phĂ¹ há»£p, increment revision.
6. Frontend thay local word báº±ng server word náº¿u response OK.

### Cáº­p nháº­t tá»«

1. User chá»n edit row.
2. `vocab.js` validate vĂ  update local.
3. Frontend gá»i `PUT /api/vocab/{id}` náº¿u cĂ³ id/server.
4. Backend lock user, find word by id/user, check duplicate, apply fields, save, increment revision.

### XĂ³a tá»«

1. User delete word.
2. `vocab.js` xĂ³a local vocab vĂ  wrongWords theo English.
3. `app.js` gá»i `DELETE /api/vocab/{id}` náº¿u word cĂ³ cloud id.
4. Náº¿u delete cloud fail, id vĂ o delete queue.
5. Sync bá»‹ pause cho Ä‘áº¿n khi delete queue flush thĂ nh cĂ´ng hoáº·c backoff chÆ°a tá»›i háº¡n.

### Äá»“ng bá»™ cloud

1. Auth bootstrap set cloud ready.
2. Frontend `pullCloudSnapshot`.
3. Merge local/cloud theo id hoáº·c normalized English, chá»n field theo `updatedAt`.
4. Khi dá»¯ liá»‡u local thay Ä‘á»•i, `scheduleCloudSync`.
5. `syncCloudNow` flush pending deletes.
6. Gá»­i `POST /api/sync` vá»›i `expectedRevision`.
7. Backend kiá»ƒm tra revision, upsert data, increment revision.
8. Náº¿u 409, frontend pull snapshot má»›i vĂ  khĂ´ng retry push ngay.

### Quiz

1. User chá»n mode/difficulty/start.
2. `quiz.js` táº¡o question set tá»« local vocab.
3. User chá»n answer.
4. UI lock answer, show feedback, update combo.
5. `recordWordResult` cáº­p nháº­t local stats/wrongWords.
6. Finish quiz ghi local history.
7. `app.js` wrapper gá»­i `/api/quiz-results`.
8. Backend táº¡o quiz history, cáº­p nháº­t stats, XP, achievements, revision.

### Review Today

1. User má»Ÿ Review Today.
2. `review-today.js` gá»i `/api/review/queue?limit=8`.
3. Náº¿u lá»—i hoáº·c khĂ´ng auth, fallback local due queue.
4. User reveal answer vĂ  chá»n rating.
5. Náº¿u cloud available, gá»i `/api/review/answer`.
6. Backend cáº­p nháº­t stats/nextReview/mastery/revision.
7. UI cáº­p nháº­t session progress.

### Analytics

1. User má»Ÿ Analytics.
2. `analytics-dashboard.js` gá»i 5 endpoint analytics song song.
3. Backend tĂ­nh toĂ¡n tá»« repositories.
4. Náº¿u gá»i cloud fail, frontend tĂ­nh analytics tá»« local vocab/history.
5. UI render cards, chart, pressure, weak words, insights, tag performance.

### AI giáº£i thĂ­ch cĂ¢u sai

1. User á»Ÿ review wrong answer click AI explanation.
2. `ai-explain.js` Ă¡p cooldown 7 giĂ¢y client-side.
3. Gá»­i `/api/ai/explain-wrong-answer`.
4. Backend rate limit theo user/action.
5. Náº¿u OpenAI configured, gá»i Responses API vá»›i JSON schema.
6. Náº¿u khĂ´ng configured hoáº·c lá»—i, dĂ¹ng rule-based fallback.
7. UI render explanation panel.

### AI táº¡o deck

1. User má»Ÿ Learning Studio AI Deck tab.
2. Nháº­p text, target level, max words.
3. `learning-studio.js` gá»­i `/api/ai/generate-deck`.
4. Backend rate limit deck.
5. OpenAI client hoáº·c fallback dictionary táº¡o items.
6. UI cho user review/edit/select rá»“i import vĂ o local vocab.

## 12. Sequence Flow

### Táº¡o tá»«

```text
User
â†“
frontend/js/vocab.js addWord
â†“
localStorage save
â†“
frontend/js/app.js quizCloud.createWord
â†“
VocabularyController POST /api/vocab
â†“
CurrentUserService.requireUser
â†“
VocabularyService.createWord
â†“
AppUserRepository.findByIdForSyncUpdate
â†“
VocabularyRepository
â†“
Database vocabulary/app_users/user_achievements
```

### Sync

```text
User action hoáº·c scheduled sync
â†“
frontend/js/app.js syncCloudNow
â†“
flushPendingCloudDeletes
â†“
VocabularyController POST /api/sync
â†“
CurrentUserService.requireUser
â†“
VocabularyService.sync
â†“
AppUserRepository pessimistic lock
â†“
VocabularyRepository / WrongBankRepository
â†“
Database
â†“
SyncResponse snapshot
```

### Quiz result

```text
User completes quiz
â†“
frontend/js/quiz.js finishQuiz
â†“
frontend/js/app.js submitCloudQuizResult
â†“
VocabularyController POST /api/quiz-results
â†“
VocabularyService.recordQuizResult
â†“
VocabularyRepository / WrongBankRepository / QuizHistoryRepository / AchievementService
â†“
Database
â†“
SyncResponse
```

### Review answer

```text
User answers review
â†“
frontend/js/review-today.js postAnswer
â†“
ReviewController POST /api/review/answer
â†“
CurrentUserService.requireUser
â†“
SpacedRepetitionService.answer
â†“
AppUserRepository lock
â†“
VocabularyRepository
â†“
Database word_stats/vocabulary/app_users
```

### Analytics

```text
User opens Analytics
â†“
frontend/js/analytics-dashboard.js fetchCloudAnalytics
â†“
LearningAnalyticsController
â†“
LearningAnalyticsService
â†“
VocabularyRepository / QuizHistoryRepository
â†“
Database
```

### AI explanation

```text
User clicks AI explain
â†“
frontend/js/ai-explain.js
â†“
AiExplanationController
â†“
CurrentUserService.requireUser
â†“
AiRateLimitService.check
â†“
AiExplanationService
â†“
OpenAiExplanationClient hoáº·c RuleBasedExplanationService
â†“
Response DTO
```

