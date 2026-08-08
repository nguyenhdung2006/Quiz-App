# Project Handover - Database And Model

Historical split from $source lines 341-665. Content preserved for reference.

## 5. Database

Nguá»“n schema chĂ­nh: `database/schema.sql`. Migration cĂ³ trong `backend/src/main/resources/db/migration`. Flyway disabled máº·c Ä‘á»‹nh trong `application.properties`.

### Báº£ng `app_users`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `username` | `VARCHAR(255)` | yes | DB legacy, unique. Entity `AppUser` hiá»‡n khĂ´ng map cá»™t nĂ y. |
| `password_hash` | `VARCHAR(255)` | yes | DB legacy, entity hiá»‡n khĂ´ng map. |
| `email` | `VARCHAR(255)` | yes | Unique, dĂ¹ng trong OAuth lookup. |
| `google_subject` | `VARCHAR(255)` | yes | Unique, Google `sub`. |
| `display_name` | `VARCHAR(255)` | yes | TĂªn hiá»ƒn thá»‹. |
| `avatar_url` | `TEXT` | yes | Avatar URL. |
| `role` | `VARCHAR(20)` | no | Default `USER`, check `USER` hoáº·c `ADMIN`. |
| `xp` | `INTEGER` | no | Default 0, check `>=0`. |
| `level` | `INTEGER` | no | Default 1, check `>=1`. |
| `streak` | `INTEGER` | no | Default 0, check `>=0`. |
| `best_streak` | `INTEGER` | no | Default 0, check `>=0`. |
| `birthday` | `DATE` | yes | Profile. |
| `gender` | `VARCHAR(40)` | yes | Profile. |
| `learning_goal` | `VARCHAR(160)` | yes | Profile. |
| `bio` | `TEXT` | yes | Profile. |
| `last_active_date` | `DATE` | yes | Set má»—i láº§n require user. |
| `sync_revision` | `BIGINT` | no | Default 0, optimistic sync token cáº¥p user. |
| `created_at` | `TIMESTAMPTZ` | no | Default now. |
| `updated_at` | `TIMESTAMPTZ` | no | Default now, trigger update. |

Constraints/index:

- PK `app_users(id)`.
- Unique: `username`, `email`, `google_subject`.
- Check: role, xp, level, streak, best_streak.
- Trigger `trg_app_users_updated_at` cáº­p nháº­t `updated_at`.

### Báº£ng `vocabulary`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `user_id` | `BIGINT` | no | FK `app_users(id)` cascade delete. |
| `eng` | `VARCHAR(255)` | no | Tá»«/cá»¥m tiáº¿ng Anh. |
| `vie` | `VARCHAR(255)` | no | NghÄ©a tiáº¿ng Viá»‡t. |
| `pos` | `VARCHAR(50)` | no | Default `n`. |
| `tag` | `VARCHAR(100)` | yes | Chá»§ Ä‘á». |
| `ipa` | `VARCHAR(120)` | yes | PhiĂªn Ă¢m. |
| `word_level` | `VARCHAR(40)` | yes | Level há»c. |
| `context` | `TEXT` | yes | Ngá»¯ cáº£nh/nghÄ©a. |
| `example` | `TEXT` | yes | CĂ¢u vĂ­ dá»¥. |
| `example_meaning` | `TEXT` | yes | NghÄ©a cĂ¢u vĂ­ dá»¥. |
| `collocation` | `TEXT` | yes | Collocation. |
| `synonyms` | `TEXT` | yes | Äá»“ng nghÄ©a. |
| `antonyms` | `TEXT` | yes | TrĂ¡i nghÄ©a. |
| `common_mistake` | `TEXT` | yes | Lá»—i thÆ°á»ng gáº·p. |
| `note` | `TEXT` | yes | Ghi chĂº. |
| `favorite` | `BOOLEAN` | no | Default false. |
| `mastered` | `BOOLEAN` | no | Default false. |
| `created_at` | `TIMESTAMPTZ` | no | Default now. |
| `updated_at` | `TIMESTAMPTZ` | no | Default now, trigger update. |

Constraints/index:

- PK `vocabulary(id)`.
- FK `vocabulary_user_fk(user_id)` references `app_users(id)` on delete cascade.
- Unique `(user_id, eng)`.
- Check `btrim(eng) <> ''` vĂ  `btrim(vie) <> ''`.
- Index `idx_vocabulary_user(user_id)`.
- Index `idx_vocabulary_user_lower_eng(user_id, lower(eng))`.
- Index `idx_vocabulary_user_tag(user_id, tag)`.
- Trigger `trg_vocabulary_updated_at`.

### Báº£ng `word_stats`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `word_id` | `BIGINT` | no | FK unique tá»›i `vocabulary(id)`. |
| `seen` | `INTEGER` | no | Default 0. |
| `correct` | `INTEGER` | no | Default 0. |
| `wrong` | `INTEGER` | no | Default 0. |
| `current_streak` | `INTEGER` | no | Default 0. |
| `best_streak` | `INTEGER` | no | Default 0. |
| `mastery_level` | `INTEGER` | no | Default 0. |
| `last_reviewed` | `TIMESTAMPTZ` | yes | Láº§n Ă´n cuá»‘i. |
| `next_review` | `TIMESTAMPTZ` | yes | Lá»‹ch Ă´n tiáº¿p. |
| `created_at` | `TIMESTAMPTZ` | no | Default now. |
| `updated_at` | `TIMESTAMPTZ` | no | Default now. |

Constraints/index:

- PK `word_stats(id)`.
- FK `word_stats_word_fk(word_id)` references `vocabulary(id)` on delete cascade.
- Unique `word_id`.
- Check `seen >= 0`, `correct >= 0`, `wrong >= 0`, `mastery_level between 0 and 5`.
- Index `idx_word_stats_next_review(next_review)`.
- Trigger `trg_word_stats_updated_at`.

### Báº£ng `wrong_bank`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `user_id` | `BIGINT` | no | FK user. |
| `word_id` | `BIGINT` | no | FK word. |
| `mastered` | `BOOLEAN` | no | Default false. |
| `created_at` | `TIMESTAMPTZ` | no | Default now. |
| `updated_at` | `TIMESTAMPTZ` | no | Default now. |

Constraints/index:

- PK `wrong_bank(id)`.
- FK `wrong_bank_user_fk(user_id)` references `app_users(id)` on delete cascade.
- FK `wrong_bank_word_fk(word_id)` references `vocabulary(id)` on delete cascade.
- Unique `(user_id, word_id)`.
- Index `idx_wrong_bank_user(user_id)`.
- Trigger `trg_wrong_bank_updated_at`.

### Báº£ng `quiz_history`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `user_id` | `BIGINT` | no | FK user. |
| `total_questions` | `INTEGER` | no | Default 0. |
| `correct_answers` | `INTEGER` | no | Default 0. |
| `wrong_answers` | `INTEGER` | no | Default 0. |
| `score` | `NUMERIC(5,2)` | no | Default 0, check 0..10. |
| `quiz_mode` | `VARCHAR(50)` | yes | mixed, daily, challenge hoáº·c mode tá»« client. |
| `challenge_seconds` | `INTEGER` | yes | Thá»i lÆ°á»£ng challenge. |
| `max_combo` | `INTEGER` | no | Default 0. |
| `created_at` | `TIMESTAMPTZ` | no | Default now. |

Constraints/index:

- PK `quiz_history(id)`.
- FK `quiz_history_user_fk(user_id)` references `app_users(id)` on delete cascade.
- Check total/correct/wrong/max_combo khĂ´ng Ă¢m, score 0..10.
- Index `idx_quiz_history_user_created(user_id, created_at desc)`.

### Báº£ng `quiz_history_answers`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `quiz_history_id` | `BIGINT` | no | FK quiz history cascade delete. |
| `word_id` | `BIGINT` | yes | FK vocabulary set null náº¿u word bá»‹ xĂ³a. |
| `question_mode` | `VARCHAR(20)` | yes | `eng`, `vie` hoáº·c mixed submode. |
| `prompt` | `TEXT` | yes | Prompt hiá»ƒn thá»‹. |
| `selected_answer` | `TEXT` | yes | CĂ¢u tráº£ lá»i user chá»n. |
| `correct_answer` | `TEXT` | yes | ÄĂ¡p Ă¡n Ä‘Ăºng. |
| `is_correct` | `BOOLEAN` | no | Káº¿t quáº£. |
| `answered_at` | `TIMESTAMPTZ` | no | Default now. |

Constraints/index:

- PK `quiz_history_answers(id)`.
- FK `quiz_answers_history_fk(quiz_history_id)` references `quiz_history(id)` on delete cascade.
- FK `quiz_answers_word_fk(word_id)` references `vocabulary(id)` on delete set null.
- Index `idx_quiz_answers_history(quiz_history_id)`.

### Báº£ng `achievements`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `id` | `BIGSERIAL` | no | Primary key. |
| `code` | `VARCHAR(80)` | no | Unique achievement code. |
| `name` | `VARCHAR(120)` | no | Unique display name. |
| `description` | `TEXT` | yes | MĂ´ táº£. |
| `xp_reward` | `INTEGER` | no | Default 0, check `>=0`. |
| `created_at` | `TIMESTAMPTZ` | no | Default now. |

Seed achievements trong `schema.sql`: `FIRST_WORD`, `FIRST_QUIZ`, `PERFECT_ROUND`, `COMBO_10`, `DAILY_CHALLENGE`.

### Báº£ng `user_achievements`

| Cá»™t | Kiá»ƒu | Null | Ghi chĂº |
|---|---|---|---|
| `user_id` | `BIGINT` | no | FK user. |
| `achievement_id` | `BIGINT` | no | FK achievement. |
| `unlocked_at` | `TIMESTAMPTZ` | no | Default now. |

Constraints:

- Composite PK `(user_id, achievement_id)`.
- FK user cascade delete.
- FK achievement cascade delete.

### Migration

| File | Ná»™i dung |
|---|---|
| `V1__baseline_schema.sql` | Táº¡o schema baseline, indexes, trigger function vĂ  seed achievements. Báº£n nĂ y khĂ´ng cĂ³ `sync_revision` trong `app_users`. |
| `V2__add_sync_revision.sql` | ThĂªm `sync_revision BIGINT NOT NULL DEFAULT 0` cho `app_users`. |

Trong `application.properties`, `spring.flyway.enabled=${FLYWAY_ENABLED:false}` nĂªn migration khĂ´ng cháº¡y máº·c Ä‘á»‹nh. `database/schema.sql` lĂ  script production/manual Ä‘áº§y Ä‘á»§ hÆ¡n vĂ  cĂ³ nhiá»u `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` Ä‘á»ƒ sá»­a drift.

## 6. Entity / Model

### `AppUser`

Ă nghÄ©a: tĂ i khoáº£n ngÆ°á»i dĂ¹ng gáº¯n vá»›i Google OAuth vĂ  tiáº¿n Ä‘á»™ há»c.

Thuá»™c tĂ­nh chĂ­nh: `id`, `email`, `googleSubject`, `displayName`, `avatarUrl`, `role`, `xp`, `level`, `streak`, `bestStreak`, `birthday`, `gender`, `learningGoal`, `bio`, `lastActiveDate`, `syncRevision`, `createdAt`, `updatedAt`.

Quan há»‡: Ä‘Æ°á»£c tham chiáº¿u bá»Ÿi vocabulary, wrong bank, quiz history, user achievements.

Business rule:

- `@PrePersist` set `createdAt`, `updatedAt`.
- `@PreUpdate` set `updatedAt`.
- Getter sá»‘ tráº£ 0/1 máº·c Ä‘á»‹nh khi field null.
- `setSyncRevision` clamp vá» `>=0`.
- `incrementSyncRevision` tÄƒng revision.
- Role admin Ä‘Æ°á»£c kiá»ƒm tra trong `CurrentUserService.requireAdmin` báº±ng chuá»—i `ADMIN`.

### `VocabularyWord`

Ă nghÄ©a: má»™t tá»«/cá»¥m tá»« vá»±ng cá»§a má»™t user.

Thuá»™c tĂ­nh: `eng`, `vie`, `pos`, `tag`, `ipa`, `level`, `context`, `example`, `exampleMeaning`, `collocation`, `synonyms`, `antonyms`, `commonMistake`, `note`, `favorite`, `mastered`, timestamps.

Quan há»‡:

- `ManyToOne LAZY` tá»›i `AppUser`.
- `OneToOne` tá»›i `WordStats`, cascade all, orphan removal.
- CĂ³ thá»ƒ Ä‘Æ°á»£c tham chiáº¿u bá»Ÿi `WrongBankEntry` vĂ  `QuizHistoryAnswer`.

Business rule:

- Unique DB `(user_id, eng)`.
- Service duplicate check báº±ng normalized lowercase/trim trong danh sĂ¡ch tá»« cá»§a user.
- Default `pos` lĂ  `n`, default level á»Ÿ service lĂ  `A1`.
- `mastered=true` khi streak Ä‘áº¡t 5 trong quiz/review logic.

### `WordStats`

Ă nghÄ©a: thá»‘ng kĂª há»c táº­p theo tá»«ng tá»«.

Thuá»™c tĂ­nh: `seen`, `correct`, `wrong`, `currentStreak`, `bestStreak`, `masteryLevel`, `lastReviewed`, `nextReview`, timestamps.

Quan há»‡: `OneToOne LAZY` tá»›i `VocabularyWord`, FK unique `word_id`.

Business rule:

- Counts khĂ´ng Ă¢m, mastery 0..5 á»Ÿ DB vĂ  service/DTO.
- Khi Ä‘Ăºng: tÄƒng `seen`, `correct`, `currentStreak`, `bestStreak`, `masteryLevel` tá»‘i Ä‘a 5.
- Khi sai: tÄƒng `seen`, `wrong`, reset current streak, giáº£m mastery.
- `nextReview` theo fixed interval dá»±a trĂªn streak.

### `WrongBankEntry`

Ă nghÄ©a: Ä‘Ă¡nh dáº¥u má»™t tá»« Ä‘ang náº±m trong danh sĂ¡ch tráº£ lá»i sai cá»§a user.

Thuá»™c tĂ­nh: `mastered`, timestamps.

Quan há»‡: `ManyToOne` user, `ManyToOne` word. Unique `(user_id, word_id)`.

Business rule:

- Khi tráº£ lá»i sai quiz, entry Ä‘Æ°á»£c táº¡o hoáº·c set `mastered=false`.
- Khi tráº£ lá»i Ä‘Ăºng, entry Ä‘Æ°á»£c set `mastered=true` hoáº·c cĂ³ thá»ƒ bá»‹ xĂ³a á»Ÿ frontend local.

### `QuizHistory`

Ă nghÄ©a: má»™t lÆ°á»£t quiz Ä‘Ă£ hoĂ n thĂ nh.

Thuá»™c tĂ­nh: total/correct/wrong, score, quizMode, challengeSeconds, maxCombo, createdAt.

Quan há»‡:

- `ManyToOne` user.
- `OneToMany` answers, cascade all, orphan removal.

Business rule:

- `addAnswer` set back-reference.
- Quiz XP tĂ­nh trong `VocabularyService.recordQuizResult`: `correct * 12 + total * 3 + maxCombo`.

### `QuizHistoryAnswer`

Ă nghÄ©a: cĂ¢u tráº£ lá»i cá»¥ thá»ƒ trong má»™t lÆ°á»£t quiz.

Thuá»™c tĂ­nh: questionMode, prompt, selectedAnswer, correctAnswer, correct, answeredAt.

Quan há»‡:

- `ManyToOne` quiz history.
- `ManyToOne` word, nullable.

Business rule: náº¿u word bá»‹ xĂ³a trong DB, FK set null theo schema.

### `Achievement`

Ă nghÄ©a: Ä‘á»‹nh nghÄ©a badge/thĂ nh tá»±u.

Thuá»™c tĂ­nh: code, name, description, xpReward, createdAt.

Business rule:

- `AchievementService.defaultAchievement` táº¡o thĂ´ng tin máº·c Ä‘á»‹nh náº¿u code chÆ°a tá»“n táº¡i.
- CĂ¡c code chĂ­nh: `FIRST_WORD`, `FIRST_QUIZ`, `PERFECT_ROUND`, `COMBO_10`, `DAILY_CHALLENGE`.

### `UserAchievement` vĂ  `UserAchievementId`

Ă nghÄ©a: quan há»‡ user Ä‘Ă£ unlock achievement nĂ o.

Thuá»™c tĂ­nh: embedded id `(userId, achievementId)`, `unlockedAt`.

Business rule:

- `AchievementService.unlock` bá» qua náº¿u `UserAchievementId` Ä‘Ă£ tá»“n táº¡i.
- Khi unlock, cá»™ng `xpReward` vĂ  tĂ­nh láº¡i level.

### DTO/model chĂ­nh

- `ProfileRequest`, `ProfileDto`: profile user vĂ  validation.
- `WordRequest`, `WordDto`, `WordStatsDto`: vocabulary payload vĂ  response.
- `SyncRequest`, `SyncResponse`, `SyncConflictResponse`: Ä‘á»“ng bá»™ local/cloud.
- `QuizResultRequest`, `QuizAnswerRequest`, `QuizHistoryDto`: quiz result/history.
- `ReviewQueueItemDto`, `ReviewAnswerRequest`, `ReviewAnswerResponse`: spaced repetition.
- `AnalyticsOverviewDto`, `AccuracyTrendDto`, `WeakWordDto`, `ReviewPressureDto`, `TagPerformanceDto`, `PerformanceMetricDto`, `LearningInsightDto`: analytics.
- `ExplainWrongAnswerRequest/Response`, `GenerateDeckRequest`, `GeneratedDeckResponse`, `GeneratedDeckWordDto`, `AiRateLimitError`: AI API.
- Frontend local model mirror gáº§n giá»‘ng `WordDto`, lÆ°u trong `localStorage` vá»›i nested `stats`.

