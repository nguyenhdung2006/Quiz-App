# WordArena Production Schema Drift Audit

Date: 2026-06-08

## Scope

This audit compares backend entity expectations, local/test schema behavior, the manual PostgreSQL schema file, and likely Supabase production drift risks.

No runtime code was changed. No production schema changes were made. All SQL in this document is read-only `SELECT` SQL intended for manual inspection in Supabase.

## Executive Summary

Production has already shown a class of failures where legacy `NULL` values were hydrated into Java fields that the application expected to be non-null. Recent backend hardening reduced the immediate 500 risk by making several entity fields nullable wrappers with safe getters, but the database still needs a schema/data audit before Flyway baseline planning. The biggest drift risk is that `database/schema.sql` contains strict fresh-table definitions, then later contains additive repair statements for existing Supabase databases. Those repair statements add columns and defaults but often do not add `NOT NULL`, checks, unique constraints, or all foreign-key guarantees to already-existing tables.

## Schema Sources Reviewed

- Java entities under `backend/src/main/java/com/quizapp`
- Manual PostgreSQL schema: `database/schema.sql`
- Flyway baseline draft: `backend/src/main/resources/db/migration/V1__baseline_schema.sql`
- PostgreSQL guidance: `docs/backend-postgres.md`
- Backend regression tests that simulate legacy `NULL` rows in `BackendHardeningTests`

## Key Drift Pattern

`database/schema.sql` starts with strict `CREATE TABLE IF NOT EXISTS` definitions, but `CREATE TABLE IF NOT EXISTS` does not repair existing tables. The later additive repair section uses statements such as:

```sql
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS seen INTEGER DEFAULT 0;
```

These statements give defaults to new inserts, but they do not guarantee that existing rows have non-null values, and they do not necessarily add the same constraints that the fresh schema expects.

## Table Findings

### app_users

Expected Java entity: `AppUser`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low if table exists normally | Low |
| email | String | Yes for auth/profile identity | `NOT NULL`, unique | Repair adds nullable `email` | High |
| google_subject | String | Preferred OAuth identity, nullable by entity | Unique nullable | Repair adds nullable | Medium |
| role | String | Defaults to `USER` | `NOT NULL DEFAULT 'USER'` | Repair adds default but nullable | Medium |
| xp | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable; old rows can be null | Medium |
| level | Integer | Getter returns 1 if null or less than 1 | `NOT NULL DEFAULT 1` | Repair adds default but nullable | Medium |
| streak | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | Medium |
| best_streak | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | Medium |
| created_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Repair adds default but nullable | High |
| updated_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Repair adds default but nullable | High |

Endpoints affected:

- `GET /api/me`
- `PUT /api/profile`
- `GET /api/snapshot`
- `POST /api/sync`
- All authenticated endpoints through `CurrentUserService.requireUser()`
- Analytics overview because it reads XP/streak

Notes:

- Recent hardening makes XP/level/streak getters null-safe, which reduces DTO crashes.
- A production row with null `email`, `created_at`, or `updated_at` is still suspicious and should be inspected before Flyway baseline.
- A transient `/api/me` 500 can still happen if auth lookup touches a malformed legacy user row or an invalid constraint state.

Recommended safe fix:

- First run the read-only null and constraint queries below.
- If nulls exist, plan a reviewed data-cleanup migration separately. Do not enable Flyway until the actual production state is known.

### vocabulary

Expected Java entity: `VocabularyWord`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low | Low |
| user_id | AppUser FK | Yes for ownership/security | `NOT NULL REFERENCES app_users` | Repair adds FK but nullable | High |
| eng | String | Yes, required word text | `NOT NULL`, blank check | Repair adds nullable; no repair blank check | High |
| vie | String | Yes, required meaning | `NOT NULL`, blank check | Repair adds nullable; no repair blank check | High |
| pos | String | Defaults to `n` in entity | `NOT NULL DEFAULT 'n'` | Repair adds default but nullable | Medium |
| tag | String | Optional | Nullable | Nullable | Low |
| ipa/context/example/etc. | String | Optional | Nullable | Nullable | Low |
| word_level | String | Optional CEFR-ish metadata | Nullable | Nullable | Low |
| favorite | Boolean | Getter returns false if null | `NOT NULL DEFAULT FALSE` | Repair adds default but nullable | High |
| mastered | Boolean | Getter returns false if null | `NOT NULL DEFAULT FALSE` | Repair adds default but nullable | High |
| created_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Repair adds default but nullable | High |
| updated_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Repair adds default but nullable | High |

Endpoints affected:

- `GET /api/vocab`
- `POST /api/vocab`
- `PUT /api/vocab/{id}`
- `DELETE /api/vocab/{id}`
- `GET /api/snapshot`
- `POST /api/sync`
- `GET /api/review/queue`
- Analytics overview, weak words, review pressure, accuracy/tag performance

Notes:

- The previous production snapshot crash was consistent with `favorite`/`mastered` null drift.
- Backend duplicate protection normalizes English in service logic, but the database fresh schema still uses a case-sensitive unique constraint on `(user_id, eng)`. Production should be inspected for normalized duplicates before any baseline.
- Nullable `user_id`, `eng`, or `vie` rows are high-risk because they affect ownership, sync identity, and user-facing vocabulary rendering.

Recommended safe fix:

- Inspect nulls, orphan rows, and normalized duplicate words.
- If production contains duplicates after normalization, do not add stricter uniqueness until a manual merge plan exists.

### word_stats

Expected Java entity: `WordStats`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low | Low |
| word_id | VocabularyWord FK | Yes, one stats row per word | `UNIQUE NOT NULL REFERENCES vocabulary` | Repair adds FK but nullable; uniqueness may be absent on existing table | High |
| seen | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | High |
| correct | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | High |
| wrong | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | High |
| current_streak | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | High |
| best_streak | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Repair adds default but nullable | High |
| mastery_level | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0`, range check | Repair adds default but nullable; check may be absent | High |
| last_reviewed | Instant | Optional | Nullable | Nullable | Low |
| next_review | Instant | Optional | Nullable | Nullable | Low |
| created_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Repair adds default but nullable | Medium |
| updated_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Repair adds default but nullable | Medium |

Endpoints affected:

- `GET /api/snapshot`
- `POST /api/sync`
- `GET /api/review/queue`
- `POST /api/review/answer`
- Analytics overview, review pressure, weak words, tag performance

Notes:

- This is one of the highest-risk tables because multiple production failing endpoints read it.
- Missing or duplicate stats rows can make analytics inconsistent even when no 500 is thrown.
- The entity now tolerates null numeric fields, but schema drift can still cause wrong analytics and review prioritization.

Recommended safe fix:

- Inspect null numeric fields, missing stats rows for vocabulary words, orphan stats, duplicate `word_id` rows, and missing unique constraints.

### wrong_bank

Expected Java entity: `WrongBankEntry`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low | Low |
| user_id | AppUser FK | Yes | `NOT NULL REFERENCES app_users` | No detailed repair block if table already existed | High |
| word_id | VocabularyWord FK | Yes | `NOT NULL REFERENCES vocabulary` | No detailed repair block if table already existed | High |
| mastered | Boolean | Getter returns false if null | `NOT NULL DEFAULT FALSE` | Existing table may remain nullable | Medium |
| created_at | Instant | Entity has field, no explicit nullable annotation | `NOT NULL DEFAULT NOW()` | Existing table may drift | Medium |
| updated_at | Instant | Entity has field, trigger expected | `NOT NULL DEFAULT NOW()` | Existing table may drift | Medium |

Endpoints affected:

- `GET /api/wrong-words`
- `GET /api/snapshot`
- `POST /api/sync`
- Weak word and review-related UX indirectly

Notes:

- `wrong_bank` has a fresh unique constraint `(user_id, word_id)`, but existing production tables may not have it if created before the final schema.
- Orphan wrong-bank rows are risky because they can point at deleted vocabulary words or users.

Recommended safe fix:

- Inspect nulls, orphans, and duplicate `(user_id, word_id)` rows.

### quiz_history

Expected Java entity: `QuizHistory`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low | Low |
| user_id | AppUser FK | Yes | `NOT NULL REFERENCES app_users` | No detailed repair block if table already existed | High |
| total_questions | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Existing table may remain nullable | High |
| correct_answers | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Existing table may remain nullable | High |
| wrong_answers | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Existing table may remain nullable | High |
| score | Double | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Existing table may remain nullable | High |
| quiz_mode | String | Required by entity and DTO | `NOT NULL` | Existing table may drift | Medium |
| challenge_seconds | Integer | Optional | Nullable | Nullable | Low |
| max_combo | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Existing table may remain nullable | High |
| created_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Existing table may remain nullable | High |

Endpoints affected:

- `POST /api/quiz-results`
- `GET /api/quiz-history`
- `GET /api/snapshot`
- `GET /api/analytics/overview`
- `GET /api/analytics/accuracy-trend`
- `GET /api/analytics/tag-performance`

Notes:

- Analytics previously risked null timestamp crashes. Recent hardening skips null `created_at` in date-bucketed analytics where needed.
- Null quiz metrics still represent data quality drift even if getters prevent 500s.

Recommended safe fix:

- Inspect metric nulls and null `created_at`.
- Inspect quiz rows without a valid user before relying on production analytics.

### quiz_history_answers

Expected Java entity: `QuizHistoryAnswer`

Actual table name: `quiz_history_answers`

Note: The roadmap/task wording sometimes says `quiz_history_answer` singular, but the code and schema use `quiz_history_answers` plural.

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low | Low |
| quiz_history_id | QuizHistory FK | Yes | `NOT NULL REFERENCES quiz_history` | No detailed repair block if table already existed | High |
| word_id | VocabularyWord FK | Optional | Nullable, `ON DELETE SET NULL` | Existing FK action may drift | Medium |
| question_mode | String | Required | `NOT NULL` | Existing table may drift | Medium |
| prompt | String | Required | `NOT NULL` | Existing table may drift | Medium |
| selected_answer | String | Optional | Nullable | Nullable | Low |
| correct_answer | String | Required | `NOT NULL` | Existing table may drift | Medium |
| is_correct | Boolean | Getter returns false if null | `NOT NULL DEFAULT FALSE` | Existing table may remain nullable | Medium |
| answered_at | Instant | Required by entity | `NOT NULL DEFAULT NOW()` | Existing table may drift | Medium |

Endpoints affected:

- `POST /api/quiz-results`
- Future detailed quiz review features

Notes:

- Current snapshot/analytics do not deeply serialize answer entities, so immediate production 500 risk is lower than `quiz_history`.
- Orphan answers can still break future detailed history or cleanup work.

Recommended safe fix:

- Inspect nulls and orphan answer rows before baseline.

### achievements

Expected Java entity: `Achievement`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| id | Long | Yes, identity | Primary key | Low | Low |
| code | String | Required, unique achievement key | `NOT NULL`, unique | Repair backfills and sets not null, but verify index/constraint | Medium |
| name | String | Required, unique display name | `NOT NULL`, unique | Existing table may drift | Medium |
| description | String | Optional | Nullable | Nullable | Low |
| xp_reward | Integer | Getter returns 0 if null | `NOT NULL DEFAULT 0` | Existing table may remain nullable | Medium |
| created_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Existing table may drift | Medium |

Endpoints affected:

- `GET /api/achievements`
- `GET /api/snapshot`
- Achievement unlock logic during vocabulary/quiz actions

Notes:

- Code now tolerates null `xp_reward`.
- Missing `code`, duplicate `code`, or missing seed rows can still create feature inconsistencies.

Recommended safe fix:

- Inspect achievement seed rows, nulls, and duplicate code/name.

### user_achievements

Expected Java entity: `UserAchievement`

Important columns:

| Column | Java type | Code assumes not null? | Fresh schema | Additive repair drift risk | Risk |
| --- | --- | --- | --- | --- | --- |
| user_id | Composite key FK | Yes | `NOT NULL REFERENCES app_users`, primary key part | Existing table may drift if pre-existing | Medium |
| achievement_id | Composite key FK | Yes | `NOT NULL REFERENCES achievements`, primary key part | Existing table may drift if pre-existing | Medium |
| unlocked_at | Instant | Entity marks nullable false | `NOT NULL DEFAULT NOW()` | Existing table may drift | Medium |

Endpoints affected:

- `GET /api/achievements`
- `GET /api/snapshot`
- Achievement unlock logic

Notes:

- Orphan rows are the main production risk.
- Missing composite primary key can allow duplicate unlock rows.

Recommended safe fix:

- Inspect orphan rows, null timestamps, and duplicate `(user_id, achievement_id)` pairs.

## Primitive and Wrapper Mismatch Notes

Recent backend hardening has reduced the most dangerous primitive hydration issues by using nullable wrappers plus safe getters for persisted fields such as:

- `AppUser.xp`, `level`, `streak`, `bestStreak`
- `VocabularyWord.favorite`, `mastered`
- `WordStats.seen`, `correct`, `wrong`, `currentStreak`, `bestStreak`, `masteryLevel`
- `WrongBankEntry.mastered`
- `QuizHistory.totalQuestions`, `correctAnswers`, `wrongAnswers`, `score`, `maxCombo`
- `QuizHistoryAnswer.correct`
- `Achievement.xpReward`

This is good runtime hardening, but it is not a replacement for production data cleanup. The schema should still eventually enforce the intended `NOT NULL`, default, check, unique, and foreign-key constraints after existing data is inspected and safely repaired.

## Endpoints Most Exposed to Drift

High exposure:

- `GET /api/me`
- `GET /api/snapshot`
- `POST /api/sync`
- `GET /api/review/queue`
- `GET /api/analytics/overview`
- `GET /api/analytics/review-pressure`
- `GET /api/analytics/weak-words`
- `GET /api/analytics/accuracy-trend`
- `GET /api/analytics/tag-performance`

Medium exposure:

- `GET /api/vocab`
- `POST /api/vocab`
- `PUT /api/vocab/{id}`
- `DELETE /api/vocab/{id}`
- `GET /api/wrong-words`
- `GET /api/quiz-history`
- `POST /api/quiz-results`
- `GET /api/achievements`

## Recommended Read-Only Supabase Inspection Queries

Use these queries in Supabase SQL editor. They are all read-only.

### 1. Column shape, nullability, and defaults

```sql
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
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

### 2. Constraints

```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
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

### 3. Indexes

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

### 4. app_users risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE email IS NULL) AS email_nulls,
  COUNT(*) FILTER (WHERE role IS NULL) AS role_nulls,
  COUNT(*) FILTER (WHERE xp IS NULL) AS xp_nulls,
  COUNT(*) FILTER (WHERE level IS NULL) AS level_nulls,
  COUNT(*) FILTER (WHERE streak IS NULL) AS streak_nulls,
  COUNT(*) FILTER (WHERE best_streak IS NULL) AS best_streak_nulls,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls,
  COUNT(*) FILTER (WHERE updated_at IS NULL) AS updated_at_nulls
FROM app_users;
```

### 5. vocabulary risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE user_id IS NULL) AS user_id_nulls,
  COUNT(*) FILTER (WHERE eng IS NULL) AS eng_nulls,
  COUNT(*) FILTER (WHERE vie IS NULL) AS vie_nulls,
  COUNT(*) FILTER (WHERE pos IS NULL) AS pos_nulls,
  COUNT(*) FILTER (WHERE favorite IS NULL) AS favorite_nulls,
  COUNT(*) FILTER (WHERE mastered IS NULL) AS mastered_nulls,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls,
  COUNT(*) FILTER (WHERE updated_at IS NULL) AS updated_at_nulls,
  COUNT(*) FILTER (WHERE eng IS NOT NULL AND BTRIM(eng) = '') AS blank_eng_rows,
  COUNT(*) FILTER (WHERE vie IS NOT NULL AND BTRIM(vie) = '') AS blank_vie_rows
FROM vocabulary;
```

### 6. word_stats risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE word_id IS NULL) AS word_id_nulls,
  COUNT(*) FILTER (WHERE seen IS NULL) AS seen_nulls,
  COUNT(*) FILTER (WHERE correct IS NULL) AS correct_nulls,
  COUNT(*) FILTER (WHERE wrong IS NULL) AS wrong_nulls,
  COUNT(*) FILTER (WHERE current_streak IS NULL) AS current_streak_nulls,
  COUNT(*) FILTER (WHERE best_streak IS NULL) AS best_streak_nulls,
  COUNT(*) FILTER (WHERE mastery_level IS NULL) AS mastery_level_nulls,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls,
  COUNT(*) FILTER (WHERE updated_at IS NULL) AS updated_at_nulls
FROM word_stats;
```

### 7. wrong_bank risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE user_id IS NULL) AS user_id_nulls,
  COUNT(*) FILTER (WHERE word_id IS NULL) AS word_id_nulls,
  COUNT(*) FILTER (WHERE mastered IS NULL) AS mastered_nulls,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls,
  COUNT(*) FILTER (WHERE updated_at IS NULL) AS updated_at_nulls
FROM wrong_bank;
```

### 8. quiz_history risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE user_id IS NULL) AS user_id_nulls,
  COUNT(*) FILTER (WHERE total_questions IS NULL) AS total_questions_nulls,
  COUNT(*) FILTER (WHERE correct_answers IS NULL) AS correct_answers_nulls,
  COUNT(*) FILTER (WHERE wrong_answers IS NULL) AS wrong_answers_nulls,
  COUNT(*) FILTER (WHERE score IS NULL) AS score_nulls,
  COUNT(*) FILTER (WHERE quiz_mode IS NULL) AS quiz_mode_nulls,
  COUNT(*) FILTER (WHERE max_combo IS NULL) AS max_combo_nulls,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls
FROM quiz_history;
```

### 9. quiz_history_answers risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE quiz_history_id IS NULL) AS quiz_history_id_nulls,
  COUNT(*) FILTER (WHERE question_mode IS NULL) AS question_mode_nulls,
  COUNT(*) FILTER (WHERE prompt IS NULL) AS prompt_nulls,
  COUNT(*) FILTER (WHERE correct_answer IS NULL) AS correct_answer_nulls,
  COUNT(*) FILTER (WHERE is_correct IS NULL) AS is_correct_nulls,
  COUNT(*) FILTER (WHERE answered_at IS NULL) AS answered_at_nulls
FROM quiz_history_answers;
```

### 10. achievements risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE code IS NULL) AS code_nulls,
  COUNT(*) FILTER (WHERE name IS NULL) AS name_nulls,
  COUNT(*) FILTER (WHERE xp_reward IS NULL) AS xp_reward_nulls,
  COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls
FROM achievements;
```

### 11. user_achievements risky null counts

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE user_id IS NULL) AS user_id_nulls,
  COUNT(*) FILTER (WHERE achievement_id IS NULL) AS achievement_id_nulls,
  COUNT(*) FILTER (WHERE unlocked_at IS NULL) AS unlocked_at_nulls
FROM user_achievements;
```

### 12. Orphan row checks

```sql
SELECT COUNT(*) AS vocabulary_without_valid_user
FROM vocabulary v
LEFT JOIN app_users u ON u.id = v.user_id
WHERE v.user_id IS NULL OR u.id IS NULL;
```

```sql
SELECT COUNT(*) AS word_stats_without_valid_word
FROM word_stats s
LEFT JOIN vocabulary v ON v.id = s.word_id
WHERE s.word_id IS NULL OR v.id IS NULL;
```

```sql
SELECT COUNT(*) AS wrong_bank_without_valid_user_or_word
FROM wrong_bank wb
LEFT JOIN app_users u ON u.id = wb.user_id
LEFT JOIN vocabulary v ON v.id = wb.word_id
WHERE wb.user_id IS NULL OR u.id IS NULL OR wb.word_id IS NULL OR v.id IS NULL;
```

```sql
SELECT COUNT(*) AS quiz_history_without_valid_user
FROM quiz_history qh
LEFT JOIN app_users u ON u.id = qh.user_id
WHERE qh.user_id IS NULL OR u.id IS NULL;
```

```sql
SELECT COUNT(*) AS quiz_answers_without_valid_history
FROM quiz_history_answers qa
LEFT JOIN quiz_history qh ON qh.id = qa.quiz_history_id
WHERE qa.quiz_history_id IS NULL OR qh.id IS NULL;
```

```sql
SELECT COUNT(*) AS user_achievements_without_valid_user_or_achievement
FROM user_achievements ua
LEFT JOIN app_users u ON u.id = ua.user_id
LEFT JOIN achievements a ON a.id = ua.achievement_id
WHERE ua.user_id IS NULL OR u.id IS NULL OR ua.achievement_id IS NULL OR a.id IS NULL;
```

### 13. Duplicate and uniqueness drift checks

```sql
SELECT
  user_id,
  LOWER(REGEXP_REPLACE(BTRIM(eng), '\s+', ' ', 'g')) AS normalized_eng,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY id) AS word_ids
FROM vocabulary
WHERE user_id IS NOT NULL
  AND eng IS NOT NULL
GROUP BY user_id, LOWER(REGEXP_REPLACE(BTRIM(eng), '\s+', ' ', 'g'))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, user_id;
```

```sql
SELECT
  word_id,
  COUNT(*) AS stats_rows,
  ARRAY_AGG(id ORDER BY id) AS stat_ids
FROM word_stats
WHERE word_id IS NOT NULL
GROUP BY word_id
HAVING COUNT(*) > 1
ORDER BY stats_rows DESC, word_id;
```

```sql
SELECT
  user_id,
  word_id,
  COUNT(*) AS wrong_bank_rows,
  ARRAY_AGG(id ORDER BY id) AS wrong_bank_ids
FROM wrong_bank
WHERE user_id IS NOT NULL
  AND word_id IS NOT NULL
GROUP BY user_id, word_id
HAVING COUNT(*) > 1
ORDER BY wrong_bank_rows DESC, user_id, word_id;
```

```sql
SELECT
  code,
  COUNT(*) AS rows_with_code,
  ARRAY_AGG(id ORDER BY id) AS achievement_ids
FROM achievements
WHERE code IS NOT NULL
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY rows_with_code DESC, code;
```

```sql
SELECT
  user_id,
  achievement_id,
  COUNT(*) AS unlock_rows
FROM user_achievements
WHERE user_id IS NOT NULL
  AND achievement_id IS NOT NULL
GROUP BY user_id, achievement_id
HAVING COUNT(*) > 1
ORDER BY unlock_rows DESC, user_id, achievement_id;
```

### 14. Suspicious old rows to inspect

```sql
SELECT id, email, google_subject, role, xp, level, streak, best_streak, created_at, updated_at
FROM app_users
WHERE email IS NULL
   OR role IS NULL
   OR xp IS NULL
   OR level IS NULL
   OR streak IS NULL
   OR best_streak IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL
ORDER BY id
LIMIT 100;
```

```sql
SELECT id, user_id, eng, vie, pos, favorite, mastered, created_at, updated_at
FROM vocabulary
WHERE user_id IS NULL
   OR eng IS NULL
   OR vie IS NULL
   OR pos IS NULL
   OR favorite IS NULL
   OR mastered IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL
   OR (eng IS NOT NULL AND BTRIM(eng) = '')
   OR (vie IS NOT NULL AND BTRIM(vie) = '')
ORDER BY id
LIMIT 100;
```

```sql
SELECT id, word_id, seen, correct, wrong, current_streak, best_streak, mastery_level, created_at, updated_at
FROM word_stats
WHERE word_id IS NULL
   OR seen IS NULL
   OR correct IS NULL
   OR wrong IS NULL
   OR current_streak IS NULL
   OR best_streak IS NULL
   OR mastery_level IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL
ORDER BY id
LIMIT 100;
```

```sql
SELECT id, user_id, total_questions, correct_answers, wrong_answers, score, quiz_mode, max_combo, created_at
FROM quiz_history
WHERE user_id IS NULL
   OR total_questions IS NULL
   OR correct_answers IS NULL
   OR wrong_answers IS NULL
   OR score IS NULL
   OR quiz_mode IS NULL
   OR max_combo IS NULL
   OR created_at IS NULL
ORDER BY id
LIMIT 100;
```

## Recommended Safe Fix Order

1. Run the read-only Supabase inspection queries.
2. Compare actual production nullability, defaults, constraints, indexes, triggers, and seed rows against `backend/src/main/resources/db/migration/V1__baseline_schema.sql`.
3. Review any risky rows manually before writing cleanup SQL.
4. Back up/export Supabase schema and data before any production repair.
5. Create narrowly scoped data repair scripts only after the audit results are known.
6. Add constraints only after data is clean.
7. Switch production toward `JPA_DDL_AUTO=validate` only after schema validation succeeds in a staging-like environment.

## Future Flyway Baseline Strategy

Do not enable Flyway yet.

Recommended baseline path:

1. Export the current production schema from Supabase.
2. Run all read-only drift queries in this document.
3. Compare production with `V1__baseline_schema.sql` table by table.
4. Decide whether production should be repaired to match V1 or whether V1 should be revised to reflect the real accepted baseline.
5. Apply any data cleanup and constraint repairs as reviewed, separate migration steps.
6. Only after production matches the chosen baseline, create the Flyway baseline marker intentionally.
7. Enable `JPA_DDL_AUTO=validate` first.
8. Enable `FLYWAY_ENABLED=true` only after a staging deployment proves startup, health checks, auth, snapshot, sync, review, and analytics are stable.

## Safe To Proceed?

Not yet safe to proceed directly to Flyway baseline planning. It is safe to proceed to manual Supabase read-only inspection.

Runtime hardening has reduced the chance of 500s from legacy null data, but schema drift can still cause bad analytics, duplicate vocabulary identity, orphan sync rows, and future migration failures. The next gate should be the Supabase query results, especially null counts, constraint/index presence, orphan rows, and normalized vocabulary duplicates.
