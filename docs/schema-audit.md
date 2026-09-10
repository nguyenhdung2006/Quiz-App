# Production Schema Audit

## Summary

This is a read-only audit packet for WordArena production schema verification. Direct Supabase production inspection was not executed from this workspace because no production database connection variables are available (`DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `SUPABASE_DB_URL`, `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` are not set). Therefore, production row counts and production-only drift findings are marked as pending manual Supabase verification. The repo audit shows meaningful drift risk: Flyway is present but disabled, `database/schema.sql` contains additive repair SQL while `V1__baseline_schema.sql` is a clean baseline, production has previously shown legacy `NULL` data, and the next planned `app_users.sync_revision` column must not be introduced until the read-only checks below are run.

## Tables Audited

| Table | Code Owner | Source Files | Main Endpoints Depending On It | Production Audit Status |
| --- | --- | --- | --- | --- |
| `app_users` | `AppUser` | `backend/src/main/java/com/quizapp/user/AppUser.java`, `database/schema.sql`, `backend/src/main/resources/db/migration/V1__baseline_schema.sql` | `/api/me`, `/api/profile`, OAuth login, all authenticated endpoints | Pending Supabase SELECT |
| `vocabulary` | `VocabularyWord` | `backend/src/main/java/com/quizapp/vocab/VocabularyWord.java` | `/api/vocab`, `/api/snapshot`, `/api/sync`, review, analytics | Pending Supabase SELECT |
| `word_stats` | `WordStats` | `backend/src/main/java/com/quizapp/vocab/WordStats.java` | `/api/snapshot`, `/api/review/*`, `/api/analytics/*` | Pending Supabase SELECT |
| `wrong_bank` | `WrongBankEntry` | `backend/src/main/java/com/quizapp/vocab/WrongBankEntry.java` | `/api/wrong-words`, `/api/snapshot`, `/api/sync` | Pending Supabase SELECT |
| `quiz_history` | `QuizHistory` | `backend/src/main/java/com/quizapp/vocab/QuizHistory.java` | `/api/quiz/attempts/{attemptId}/submit`, `/api/quiz-history`, `/api/analytics/*` | Pending Supabase SELECT |
| `quiz_history_answers` | `QuizHistoryAnswer` | `backend/src/main/java/com/quizapp/vocab/QuizHistoryAnswer.java` | `/api/quiz/attempts/{attemptId}/submit`, `/api/snapshot`, analytics context | Pending Supabase SELECT |
| `achievements` | `Achievement` | `backend/src/main/java/com/quizapp/vocab/Achievement.java` | `/api/achievements`, `/api/snapshot`, quiz XP awards | Pending Supabase SELECT |
| `user_achievements` | `UserAchievement` | `backend/src/main/java/com/quizapp/vocab/UserAchievement.java` | `/api/achievements`, `/api/snapshot` | Pending Supabase SELECT |

## Schema Drift Findings

### Repo-Based Findings

| Finding | Evidence | Risk | Recommendation |
| --- | --- | --- | --- |
| Production source of truth is not yet proven. | `spring.flyway.enabled=${FLYWAY_ENABLED:false}` and `spring.jpa.hibernate.ddl-auto=${JPA_DDL_AUTO:update}` in `backend/src/main/resources/application.properties`. | High | Run the Supabase SELECT queries in this report before any new schema work. Move toward `JPA_DDL_AUTO=validate` only after baseline validation. |
| Flyway baseline exists but is not active. | `backend/src/main/resources/db/migration/V1__baseline_schema.sql` exists; Flyway is disabled by default. | Medium | Treat `V1__baseline_schema.sql` as proposed baseline, not confirmed production truth, until compared to Supabase. |
| `database/schema.sql` and Flyway baseline are not identical operationally. | `database/schema.sql` uses `CREATE TABLE IF NOT EXISTS`, many `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, trigger drops/recreates, and idempotent achievement upsert. Baseline uses plain creates/inserts. | Medium | Do not baseline Flyway blindly. First inspect actual production tables, constraints, defaults, triggers, and seed rows. |
| `app_users.sync_revision` is intentionally absent. | No entity field, schema column, or migration exists. Task 3 is paused for this reason. | Medium | After audit, add it only through a planned migration with default/backfill strategy. |
| `app_users.username` and `password_hash` exist in schema files but not in current entity. | `database/schema.sql` and baseline include both columns; `AppUser.java` does not map them. | Low | Leave if legacy harmless, but document as DB-only columns before Flyway baseline. |
| Vocabulary uniqueness is case-sensitive in schema. | `ux_vocabulary_user_eng UNIQUE (user_id, eng)`; service normalizes on create/update but DB does not enforce normalized lowercase/collapsed-space uniqueness. | High | Audit duplicates before considering any unique normalized index. Do not add a unique index until duplicates are known. |
| `word_stats.current_streak` and `best_streak` lack explicit check constraints in schema. | Schema checks `seen`, `correct`, `wrong`, `mastery_level`, but not streak fields. | Medium | Audit negative streaks. Add constraints later only after data cleanup plan. |
| `findByEmailIgnoreCase` has no explicit lower email index in schema. | `AppUserRepository.findByEmailIgnoreCase`; schema has unique `email`, likely case-sensitive. | Low/Medium | Audit case-insensitive duplicate emails; consider lower email strategy later. |

## Table-by-Table Audit Notes

### `app_users`

Expected columns from code/schema: `id`, `username`, `email`, `password_hash`, `google_subject`, `display_name`, `avatar_url`, `role`, `xp`, `level`, `streak`, `best_streak`, `birthday`, `gender`, `learning_goal`, `bio`, `last_active_date`, `created_at`, `updated_at`.

Code assumes `email`, `created_at`, and `updated_at` are present. Current hardened getters tolerate nullable `xp`, `level`, `streak`, and `best_streak`, but production should still prefer non-null/defaulted values.

Risk: High until production confirms `email`, `google_subject`, timestamp defaults, unique constraints, and no case-insensitive email duplicates.

### `vocabulary`

Expected columns: `id`, `user_id`, `eng`, `vie`, `pos`, `tag`, `ipa`, `word_level`, `context`, `example`, `example_meaning`, `collocation`, `synonyms`, `antonyms`, `common_mistake`, `note`, `favorite`, `mastered`, `created_at`, `updated_at`.

Code assumes `user_id`, `eng`, `vie`, timestamps, and ownership are reliable. `favorite` and `mastered` were hardened in Java as nullable `Boolean`, but schema should still have defaults and ideally `NOT NULL`.

Risk: High for normalized duplicate words and legacy `NULL` flags/timestamps.

### `word_stats`

Expected columns: `id`, `word_id`, `seen`, `correct`, `wrong`, `current_streak`, `best_streak`, `mastery_level`, `last_reviewed`, `next_review`, `created_at`, `updated_at`.

Task 5 hardened DTO/service behavior against `NULL`, negative, huge, and unsafe timestamp values. Production should still be inspected because review and analytics rely heavily on this table.

Risk: High for legacy `NULL`, negative counters, `mastery_level > 5`, future `next_review`, and duplicate/missing `word_id`.

### `wrong_bank`

Expected columns: `id`, `user_id`, `word_id`, `mastered`, `created_at`, `updated_at`.

Schema expects unique `(user_id, word_id)` and FK cascade. If production lacks either, duplicate wrong-bank rows or orphan review state can appear.

Risk: Medium.

### `quiz_history`

Expected columns: `id`, `user_id`, `total_questions`, `correct_answers`, `wrong_answers`, `score`, `quiz_mode`, `challenge_seconds`, `max_combo`, `created_at`.

Task 5 clamps incoming quiz result numbers. Production should still be checked for `NULL`, negative, score outside `0..10`, or impossible counts.

Risk: Medium.

### `quiz_history_answers`

Expected columns: `id`, `quiz_history_id`, `word_id`, `question_mode`, `prompt`, `selected_answer`, `correct_answer`, `is_correct`, `answered_at`.

`word_id` is intentionally nullable because schema uses `ON DELETE SET NULL`; this is not an orphan by itself. Missing `quiz_history_id` parent would be a real orphan if FK is absent.

Risk: Low/Medium.

### `achievements`

Expected columns: `id`, `code`, `name`, `description`, `xp_reward`, `created_at`.

Schema and entity require unique `code` and `name`; older production rows may have missing `code` if created before the additive repair block.

Risk: Medium until code uniqueness and seed rows are verified.

### `user_achievements`

Expected columns: `user_id`, `achievement_id`, `unlocked_at`, primary key `(user_id, achievement_id)`.

Risk is mostly missing FK/PK drift.

Risk: Low/Medium.

## Nullable Risks

High-priority nullable/corrupt fields to inspect in Supabase:

| Table | Fields | Why It Matters |
| --- | --- | --- |
| `app_users` | `email`, `role`, `xp`, `level`, `streak`, `best_streak`, `created_at`, `updated_at` | Auth profile, analytics, XP, and session bootstrap. |
| `vocabulary` | `user_id`, `eng`, `vie`, `favorite`, `mastered`, `created_at`, `updated_at` | Snapshot/sync, ownership, CRUD, delete queue, analytics. |
| `word_stats` | `word_id`, `seen`, `correct`, `wrong`, `current_streak`, `best_streak`, `mastery_level`, `created_at`, `updated_at` | Review queue, accuracy, weak words, snapshot serialization. |
| `wrong_bank` | `user_id`, `word_id`, `mastered`, `created_at`, `updated_at` | Wrong answer tracking and sync. |
| `quiz_history` | `user_id`, `total_questions`, `correct_answers`, `wrong_answers`, `score`, `quiz_mode`, `max_combo`, `created_at` | Analytics trends and XP. |
| `quiz_history_answers` | `quiz_history_id`, `question_mode`, `prompt`, `correct_answer`, `is_correct`, `answered_at` | Quiz history details and analytics context. |
| `achievements` | `code`, `name`, `xp_reward`, `created_at` | Achievement lookup and snapshot. |
| `user_achievements` | `user_id`, `achievement_id`, `unlocked_at` | Achievement ownership. |

## Duplicate Vocabulary Findings

Production duplicate status: pending manual Supabase SELECT.

Expected normalization to audit:

- trim leading/trailing whitespace
- lowercase
- collapse repeated whitespace to a single space

Risk: High. Backend now protects create/update better, but existing production duplicates can still affect sync merge, analytics, review queues, and future unique-index planning.

## Orphan Data Findings

Production orphan status: pending manual Supabase SELECT.

Expected FK behavior in schema:

- `vocabulary.user_id -> app_users.id ON DELETE CASCADE`
- `word_stats.word_id -> vocabulary.id ON DELETE CASCADE`
- `wrong_bank.user_id -> app_users.id ON DELETE CASCADE`
- `wrong_bank.word_id -> vocabulary.id ON DELETE CASCADE`
- `quiz_history.user_id -> app_users.id ON DELETE CASCADE`
- `quiz_history_answers.quiz_history_id -> quiz_history.id ON DELETE CASCADE`
- `quiz_history_answers.word_id -> vocabulary.id ON DELETE SET NULL`
- `user_achievements.user_id -> app_users.id ON DELETE CASCADE`
- `user_achievements.achievement_id -> achievements.id ON DELETE CASCADE`

If any production FK is missing, orphan rows are possible and should be manually reviewed before Flyway baseline.

## Constraint / Index Findings

Expected indexes/constraints from schema files:

- Unique: `app_users.email`, `app_users.google_subject`, `app_users.username`
- Unique: `vocabulary(user_id, eng)`
- Unique: `word_stats.word_id`
- Unique: `wrong_bank(user_id, word_id)`
- Unique: `achievements.code`, `achievements.name`
- Primary key: `user_achievements(user_id, achievement_id)`
- Index: `idx_vocabulary_user`
- Index: `idx_vocabulary_user_lower_eng`
- Index: `idx_vocabulary_user_tag`
- Index: `idx_word_stats_next_review`
- Index: `idx_wrong_bank_user`
- Index: `idx_quiz_history_user_created`
- Index: `idx_quiz_answers_history`

Likely gaps to verify:

- No unique normalized vocabulary index exists. This is expected for now, but duplicates must be audited before adding one.
- No explicit lower email unique index exists. This can allow `User@x.com` and `user@x.com` if inserted outside OAuth/app flow.
- No check constraints for `word_stats.current_streak >= 0` and `word_stats.best_streak >= 0` in current schema files.
- Trigger presence for `updated_at` must be verified; missing triggers would make sync timestamps stale.

## Flyway Readiness

Current assessment: not ready to enable production Flyway blindly.

Reasons:

- Direct production schema was not inspected from this workspace.
- Previous production incidents indicate legacy `NULL` / schema drift exists or existed.
- `database/schema.sql` includes additive repair logic that may have been run manually, partially, or not at all.
- `V1__baseline_schema.sql` is clean but may not match production exactly.
- `app_users.sync_revision` requires a new migration, default value, and production backfill discipline.

Recommended readiness path:

1. Run the SELECT-only Supabase audit queries below.
2. Save results as an artifact or paste them into a follow-up audit.
3. Classify all drift as harmless, needs data cleanup, or needs migration.
4. Only then create a Flyway baseline plan.
5. After baseline is proven, plan `app_users.sync_revision BIGINT NOT NULL DEFAULT 0` as a separate migration.

## Supabase Read-Only SQL Queries

All queries below are SELECT-only.

### 1. Table and Column Shape

```sql
SELECT
  table_name,
  column_name,
  ordinal_position,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'app_users',
    'vocabulary',
    'word_stats',
    'wrong_bank',
    'quiz_history',
    'quiz_history_answers',
    'achievements',
    'user_achievements'
  )
ORDER BY table_name, ordinal_position;
```

### 2. Expected Columns Missing or Extra

```sql
WITH expected(table_name, column_name) AS (
  VALUES
    ('app_users','id'), ('app_users','username'), ('app_users','email'), ('app_users','password_hash'),
    ('app_users','google_subject'), ('app_users','display_name'), ('app_users','avatar_url'), ('app_users','role'),
    ('app_users','xp'), ('app_users','level'), ('app_users','streak'), ('app_users','best_streak'),
    ('app_users','birthday'), ('app_users','gender'), ('app_users','learning_goal'), ('app_users','bio'),
    ('app_users','last_active_date'), ('app_users','created_at'), ('app_users','updated_at'),
    ('vocabulary','id'), ('vocabulary','user_id'), ('vocabulary','eng'), ('vocabulary','vie'), ('vocabulary','pos'),
    ('vocabulary','tag'), ('vocabulary','ipa'), ('vocabulary','word_level'), ('vocabulary','context'),
    ('vocabulary','example'), ('vocabulary','example_meaning'), ('vocabulary','collocation'),
    ('vocabulary','synonyms'), ('vocabulary','antonyms'), ('vocabulary','common_mistake'), ('vocabulary','note'),
    ('vocabulary','favorite'), ('vocabulary','mastered'), ('vocabulary','created_at'), ('vocabulary','updated_at'),
    ('word_stats','id'), ('word_stats','word_id'), ('word_stats','seen'), ('word_stats','correct'),
    ('word_stats','wrong'), ('word_stats','current_streak'), ('word_stats','best_streak'),
    ('word_stats','mastery_level'), ('word_stats','last_reviewed'), ('word_stats','next_review'),
    ('word_stats','created_at'), ('word_stats','updated_at'),
    ('wrong_bank','id'), ('wrong_bank','user_id'), ('wrong_bank','word_id'), ('wrong_bank','mastered'),
    ('wrong_bank','created_at'), ('wrong_bank','updated_at'),
    ('quiz_history','id'), ('quiz_history','user_id'), ('quiz_history','total_questions'),
    ('quiz_history','correct_answers'), ('quiz_history','wrong_answers'), ('quiz_history','score'),
    ('quiz_history','quiz_mode'), ('quiz_history','challenge_seconds'), ('quiz_history','max_combo'),
    ('quiz_history','created_at'),
    ('quiz_history_answers','id'), ('quiz_history_answers','quiz_history_id'), ('quiz_history_answers','word_id'),
    ('quiz_history_answers','question_mode'), ('quiz_history_answers','prompt'),
    ('quiz_history_answers','selected_answer'), ('quiz_history_answers','correct_answer'),
    ('quiz_history_answers','is_correct'), ('quiz_history_answers','answered_at'),
    ('achievements','id'), ('achievements','code'), ('achievements','name'), ('achievements','description'),
    ('achievements','xp_reward'), ('achievements','created_at'),
    ('user_achievements','user_id'), ('user_achievements','achievement_id'), ('user_achievements','unlocked_at')
),
actual AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT 'missing_expected_column' AS issue, e.table_name, e.column_name
FROM expected e
LEFT JOIN actual a ON a.table_name = e.table_name AND a.column_name = e.column_name
WHERE a.column_name IS NULL
UNION ALL
SELECT 'unexpected_column' AS issue, a.table_name, a.column_name
FROM actual a
LEFT JOIN expected e ON e.table_name = a.table_name AND e.column_name = a.column_name
WHERE e.column_name IS NULL
  AND a.table_name IN (
    'app_users',
    'vocabulary',
    'word_stats',
    'wrong_bank',
    'quiz_history',
    'quiz_history_answers',
    'achievements',
    'user_achievements'
  )
ORDER BY issue, table_name, column_name;
```

### 3. Constraints

```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'app_users',
    'vocabulary',
    'word_stats',
    'wrong_bank',
    'quiz_history',
    'quiz_history_answers',
    'achievements',
    'user_achievements'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
```

### 4. Indexes

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'app_users',
    'vocabulary',
    'word_stats',
    'wrong_bank',
    'quiz_history',
    'quiz_history_answers',
    'achievements',
    'user_achievements'
  )
ORDER BY tablename, indexname;
```

### 5. Triggers

```sql
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'app_users',
    'vocabulary',
    'word_stats',
    'wrong_bank'
  )
ORDER BY event_object_table, trigger_name;
```

### 6. Row Counts

```sql
SELECT 'app_users' AS table_name, COUNT(*) AS row_count FROM app_users
UNION ALL SELECT 'vocabulary', COUNT(*) FROM vocabulary
UNION ALL SELECT 'word_stats', COUNT(*) FROM word_stats
UNION ALL SELECT 'wrong_bank', COUNT(*) FROM wrong_bank
UNION ALL SELECT 'quiz_history', COUNT(*) FROM quiz_history
UNION ALL SELECT 'quiz_history_answers', COUNT(*) FROM quiz_history_answers
UNION ALL SELECT 'achievements', COUNT(*) FROM achievements
UNION ALL SELECT 'user_achievements', COUNT(*) FROM user_achievements
ORDER BY table_name;
```

### 7. Dangerous NULL Counts

```sql
SELECT 'app_users.email' AS field, COUNT(*) AS null_count FROM app_users WHERE email IS NULL
UNION ALL SELECT 'app_users.role', COUNT(*) FROM app_users WHERE role IS NULL
UNION ALL SELECT 'app_users.xp', COUNT(*) FROM app_users WHERE xp IS NULL
UNION ALL SELECT 'app_users.level', COUNT(*) FROM app_users WHERE level IS NULL
UNION ALL SELECT 'app_users.streak', COUNT(*) FROM app_users WHERE streak IS NULL
UNION ALL SELECT 'app_users.best_streak', COUNT(*) FROM app_users WHERE best_streak IS NULL
UNION ALL SELECT 'app_users.created_at', COUNT(*) FROM app_users WHERE created_at IS NULL
UNION ALL SELECT 'app_users.updated_at', COUNT(*) FROM app_users WHERE updated_at IS NULL
UNION ALL SELECT 'vocabulary.user_id', COUNT(*) FROM vocabulary WHERE user_id IS NULL
UNION ALL SELECT 'vocabulary.eng', COUNT(*) FROM vocabulary WHERE eng IS NULL
UNION ALL SELECT 'vocabulary.vie', COUNT(*) FROM vocabulary WHERE vie IS NULL
UNION ALL SELECT 'vocabulary.favorite', COUNT(*) FROM vocabulary WHERE favorite IS NULL
UNION ALL SELECT 'vocabulary.mastered', COUNT(*) FROM vocabulary WHERE mastered IS NULL
UNION ALL SELECT 'vocabulary.created_at', COUNT(*) FROM vocabulary WHERE created_at IS NULL
UNION ALL SELECT 'vocabulary.updated_at', COUNT(*) FROM vocabulary WHERE updated_at IS NULL
UNION ALL SELECT 'word_stats.word_id', COUNT(*) FROM word_stats WHERE word_id IS NULL
UNION ALL SELECT 'word_stats.seen', COUNT(*) FROM word_stats WHERE seen IS NULL
UNION ALL SELECT 'word_stats.correct', COUNT(*) FROM word_stats WHERE correct IS NULL
UNION ALL SELECT 'word_stats.wrong', COUNT(*) FROM word_stats WHERE wrong IS NULL
UNION ALL SELECT 'word_stats.current_streak', COUNT(*) FROM word_stats WHERE current_streak IS NULL
UNION ALL SELECT 'word_stats.best_streak', COUNT(*) FROM word_stats WHERE best_streak IS NULL
UNION ALL SELECT 'word_stats.mastery_level', COUNT(*) FROM word_stats WHERE mastery_level IS NULL
UNION ALL SELECT 'word_stats.created_at', COUNT(*) FROM word_stats WHERE created_at IS NULL
UNION ALL SELECT 'word_stats.updated_at', COUNT(*) FROM word_stats WHERE updated_at IS NULL
UNION ALL SELECT 'wrong_bank.user_id', COUNT(*) FROM wrong_bank WHERE user_id IS NULL
UNION ALL SELECT 'wrong_bank.word_id', COUNT(*) FROM wrong_bank WHERE word_id IS NULL
UNION ALL SELECT 'wrong_bank.mastered', COUNT(*) FROM wrong_bank WHERE mastered IS NULL
UNION ALL SELECT 'quiz_history.user_id', COUNT(*) FROM quiz_history WHERE user_id IS NULL
UNION ALL SELECT 'quiz_history.total_questions', COUNT(*) FROM quiz_history WHERE total_questions IS NULL
UNION ALL SELECT 'quiz_history.correct_answers', COUNT(*) FROM quiz_history WHERE correct_answers IS NULL
UNION ALL SELECT 'quiz_history.wrong_answers', COUNT(*) FROM quiz_history WHERE wrong_answers IS NULL
UNION ALL SELECT 'quiz_history.score', COUNT(*) FROM quiz_history WHERE score IS NULL
UNION ALL SELECT 'quiz_history.quiz_mode', COUNT(*) FROM quiz_history WHERE quiz_mode IS NULL
UNION ALL SELECT 'quiz_history.max_combo', COUNT(*) FROM quiz_history WHERE max_combo IS NULL
UNION ALL SELECT 'quiz_history.created_at', COUNT(*) FROM quiz_history WHERE created_at IS NULL
UNION ALL SELECT 'quiz_history_answers.quiz_history_id', COUNT(*) FROM quiz_history_answers WHERE quiz_history_id IS NULL
UNION ALL SELECT 'quiz_history_answers.question_mode', COUNT(*) FROM quiz_history_answers WHERE question_mode IS NULL
UNION ALL SELECT 'quiz_history_answers.prompt', COUNT(*) FROM quiz_history_answers WHERE prompt IS NULL
UNION ALL SELECT 'quiz_history_answers.correct_answer', COUNT(*) FROM quiz_history_answers WHERE correct_answer IS NULL
UNION ALL SELECT 'quiz_history_answers.is_correct', COUNT(*) FROM quiz_history_answers WHERE is_correct IS NULL
UNION ALL SELECT 'quiz_history_answers.answered_at', COUNT(*) FROM quiz_history_answers WHERE answered_at IS NULL
UNION ALL SELECT 'achievements.code', COUNT(*) FROM achievements WHERE code IS NULL
UNION ALL SELECT 'achievements.name', COUNT(*) FROM achievements WHERE name IS NULL
UNION ALL SELECT 'achievements.xp_reward', COUNT(*) FROM achievements WHERE xp_reward IS NULL
UNION ALL SELECT 'achievements.created_at', COUNT(*) FROM achievements WHERE created_at IS NULL
UNION ALL SELECT 'user_achievements.user_id', COUNT(*) FROM user_achievements WHERE user_id IS NULL
UNION ALL SELECT 'user_achievements.achievement_id', COUNT(*) FROM user_achievements WHERE achievement_id IS NULL
UNION ALL SELECT 'user_achievements.unlocked_at', COUNT(*) FROM user_achievements WHERE unlocked_at IS NULL
ORDER BY field;
```

### 8. Corrupt Numeric Values

```sql
SELECT 'app_users.xp_negative' AS issue, COUNT(*) AS affected FROM app_users WHERE xp < 0
UNION ALL SELECT 'app_users.level_invalid', COUNT(*) FROM app_users WHERE level < 1
UNION ALL SELECT 'app_users.streak_negative', COUNT(*) FROM app_users WHERE streak < 0
UNION ALL SELECT 'app_users.best_streak_negative', COUNT(*) FROM app_users WHERE best_streak < 0
UNION ALL SELECT 'word_stats.seen_invalid', COUNT(*) FROM word_stats WHERE seen < 0 OR seen > 1000000
UNION ALL SELECT 'word_stats.correct_invalid', COUNT(*) FROM word_stats WHERE correct < 0 OR correct > 1000000
UNION ALL SELECT 'word_stats.wrong_invalid', COUNT(*) FROM word_stats WHERE wrong < 0 OR wrong > 1000000
UNION ALL SELECT 'word_stats.current_streak_invalid', COUNT(*) FROM word_stats WHERE current_streak < 0 OR current_streak > 1000000
UNION ALL SELECT 'word_stats.best_streak_invalid', COUNT(*) FROM word_stats WHERE best_streak < 0 OR best_streak > 1000000
UNION ALL SELECT 'word_stats.mastery_invalid', COUNT(*) FROM word_stats WHERE mastery_level < 0 OR mastery_level > 5
UNION ALL SELECT 'quiz_history.total_questions_invalid', COUNT(*) FROM quiz_history WHERE total_questions < 0 OR total_questions > 500
UNION ALL SELECT 'quiz_history.correct_answers_invalid', COUNT(*) FROM quiz_history WHERE correct_answers < 0 OR correct_answers > 500
UNION ALL SELECT 'quiz_history.wrong_answers_invalid', COUNT(*) FROM quiz_history WHERE wrong_answers < 0 OR wrong_answers > 500
UNION ALL SELECT 'quiz_history.score_invalid', COUNT(*) FROM quiz_history WHERE score < 0 OR score > 10
UNION ALL SELECT 'quiz_history.max_combo_invalid', COUNT(*) FROM quiz_history WHERE max_combo < 0 OR max_combo > 500
UNION ALL SELECT 'achievements.xp_reward_invalid', COUNT(*) FROM achievements WHERE xp_reward < 0
ORDER BY issue;
```

### 9. Timestamp Sanity

```sql
SELECT 'app_users.created_at_future' AS issue, COUNT(*) AS affected FROM app_users WHERE created_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'app_users.updated_at_future', COUNT(*) FROM app_users WHERE updated_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'vocabulary.created_at_future', COUNT(*) FROM vocabulary WHERE created_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'vocabulary.updated_at_future', COUNT(*) FROM vocabulary WHERE updated_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'word_stats.last_reviewed_future', COUNT(*) FROM word_stats WHERE last_reviewed > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'word_stats.next_review_far_future', COUNT(*) FROM word_stats WHERE next_review > NOW() + INTERVAL '370 days'
UNION ALL SELECT 'word_stats.created_at_future', COUNT(*) FROM word_stats WHERE created_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'word_stats.updated_at_future', COUNT(*) FROM word_stats WHERE updated_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'wrong_bank.created_at_future', COUNT(*) FROM wrong_bank WHERE created_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'wrong_bank.updated_at_future', COUNT(*) FROM wrong_bank WHERE updated_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'quiz_history.created_at_future', COUNT(*) FROM quiz_history WHERE created_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'quiz_history_answers.answered_at_future', COUNT(*) FROM quiz_history_answers WHERE answered_at > NOW() + INTERVAL '1 day'
UNION ALL SELECT 'app_users.created_at_ancient', COUNT(*) FROM app_users WHERE created_at < TIMESTAMPTZ '2000-01-01'
UNION ALL SELECT 'vocabulary.created_at_ancient', COUNT(*) FROM vocabulary WHERE created_at < TIMESTAMPTZ '2000-01-01'
UNION ALL SELECT 'word_stats.last_reviewed_ancient', COUNT(*) FROM word_stats WHERE last_reviewed < TIMESTAMPTZ '2000-01-01'
UNION ALL SELECT 'word_stats.next_review_ancient', COUNT(*) FROM word_stats WHERE next_review < TIMESTAMPTZ '2000-01-01'
ORDER BY issue;
```

### 10. Duplicate Normalized Vocabulary

```sql
WITH normalized AS (
  SELECT
    id,
    user_id,
    eng,
    LOWER(REGEXP_REPLACE(BTRIM(eng), '\s+', ' ', 'g')) AS normalized_eng
  FROM vocabulary
  WHERE eng IS NOT NULL
)
SELECT
  user_id,
  normalized_eng,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY id) AS word_ids,
  ARRAY_AGG(eng ORDER BY id) AS stored_words
FROM normalized
GROUP BY user_id, normalized_eng
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, user_id, normalized_eng
LIMIT 200;
```

### 11. Case-Insensitive Email Duplicates

```sql
SELECT
  LOWER(BTRIM(email)) AS normalized_email,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY id) AS user_ids,
  ARRAY_AGG(email ORDER BY id) AS emails
FROM app_users
WHERE email IS NOT NULL
GROUP BY LOWER(BTRIM(email))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, normalized_email
LIMIT 100;
```

### 12. Orphan Checks

```sql
SELECT 'vocabulary_missing_user' AS issue, COUNT(*) AS affected
FROM vocabulary v
LEFT JOIN app_users u ON u.id = v.user_id
WHERE v.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'word_stats_missing_word', COUNT(*)
FROM word_stats s
LEFT JOIN vocabulary v ON v.id = s.word_id
WHERE s.word_id IS NOT NULL AND v.id IS NULL
UNION ALL
SELECT 'wrong_bank_missing_user', COUNT(*)
FROM wrong_bank wb
LEFT JOIN app_users u ON u.id = wb.user_id
WHERE wb.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'wrong_bank_missing_word', COUNT(*)
FROM wrong_bank wb
LEFT JOIN vocabulary v ON v.id = wb.word_id
WHERE wb.word_id IS NOT NULL AND v.id IS NULL
UNION ALL
SELECT 'quiz_history_missing_user', COUNT(*)
FROM quiz_history qh
LEFT JOIN app_users u ON u.id = qh.user_id
WHERE qh.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'quiz_answers_missing_history', COUNT(*)
FROM quiz_history_answers qa
LEFT JOIN quiz_history qh ON qh.id = qa.quiz_history_id
WHERE qa.quiz_history_id IS NOT NULL AND qh.id IS NULL
UNION ALL
SELECT 'user_achievements_missing_user', COUNT(*)
FROM user_achievements ua
LEFT JOIN app_users u ON u.id = ua.user_id
WHERE ua.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'user_achievements_missing_achievement', COUNT(*)
FROM user_achievements ua
LEFT JOIN achievements a ON a.id = ua.achievement_id
WHERE ua.achievement_id IS NOT NULL AND a.id IS NULL
ORDER BY issue;
```

### 13. Duplicate Rows in One-to-One / Unique Tables

```sql
SELECT
  'word_stats_duplicate_word_id' AS issue,
  CAST(NULL AS BIGINT) AS user_id,
  word_id,
  COUNT(*) AS duplicate_count
FROM word_stats
WHERE word_id IS NOT NULL
GROUP BY word_id
HAVING COUNT(*) > 1
UNION ALL
SELECT
  'wrong_bank_duplicate_user_word',
  user_id,
  word_id,
  COUNT(*)
FROM wrong_bank
WHERE user_id IS NOT NULL AND word_id IS NOT NULL
GROUP BY user_id, word_id
HAVING COUNT(*) > 1
ORDER BY issue, duplicate_count DESC
LIMIT 200;
```

### 14. Achievement Seed Health

```sql
SELECT
  code,
  name,
  xp_reward,
  created_at
FROM achievements
WHERE code IN ('FIRST_WORD', 'FIRST_QUIZ', 'PERFECT_ROUND', 'COMBO_10', 'DAILY_CHALLENGE')
ORDER BY code;
```

### 15. Flyway State

```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'flyway_schema_history'
ORDER BY ordinal_position;
```

```sql
SELECT
  installed_rank,
  version,
  description,
  type,
  script,
  installed_on,
  success
FROM flyway_schema_history
ORDER BY installed_rank;
```

If the second query errors because `flyway_schema_history` does not exist, production has not been baselined by Flyway yet.

## Recommended Next Steps

1. Run the SELECT-only queries above in Supabase SQL editor.
2. Capture results without editing data.
3. If any query shows missing columns, missing constraints, duplicate normalized vocabulary, or corrupt counts, pause Flyway work and review manually.
4. If schema matches expected and corruption counts are zero or understood, create a Flyway baseline plan.
5. Only after baseline planning, introduce `app_users.sync_revision` as a separate, small migration with `BIGINT NOT NULL DEFAULT 0`.
6. Keep runtime code unchanged until production findings are known.

## Current Stop Condition

Direct production access is unavailable in this workspace. Safest next step is manual Supabase execution of the read-only queries above, then paste the results back for a second-pass audit with concrete production findings.
