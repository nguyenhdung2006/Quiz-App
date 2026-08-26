CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_subject VARCHAR(255) UNIQUE,
    display_name VARCHAR(120),
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    sync_revision BIGINT NOT NULL DEFAULT 0,
    birthday DATE,
    gender VARCHAR(40),
    learning_goal VARCHAR(160),
    bio TEXT,
    last_active_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_app_users_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT ck_app_users_xp CHECK (xp >= 0),
    CONSTRAINT ck_app_users_level CHECK (level >= 1),
    CONSTRAINT ck_app_users_streak CHECK (streak >= 0),
    CONSTRAINT ck_app_users_best_streak CHECK (best_streak >= 0)
);

CREATE TABLE IF NOT EXISTS vocabulary (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    word_uid UUID NOT NULL,
    eng VARCHAR(255) NOT NULL,
    vie VARCHAR(255) NOT NULL,
    pos VARCHAR(50) NOT NULL DEFAULT 'n',
    tag VARCHAR(100),
    ipa VARCHAR(120),
    word_level VARCHAR(40),
    context TEXT,
    example TEXT,
    example_meaning TEXT,
    collocation TEXT,
    synonyms TEXT,
    antonyms TEXT,
    common_mistake TEXT,
    note TEXT,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_vocabulary_user_eng UNIQUE (user_id, eng),
    CONSTRAINT ux_vocabulary_user_word_uid UNIQUE (user_id, word_uid),
    CONSTRAINT ck_vocabulary_eng_not_blank CHECK (BTRIM(eng) <> ''),
    CONSTRAINT ck_vocabulary_vie_not_blank CHECK (BTRIM(vie) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vocabulary_id_user ON vocabulary(id, user_id);

CREATE TABLE IF NOT EXISTS word_tombstones (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    word_uid UUID NOT NULL,
    legacy_word_id BIGINT,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_revision BIGINT NOT NULL,
    CONSTRAINT ux_word_tombstones_user_word_uid UNIQUE (user_id, word_uid),
    CONSTRAINT ck_word_tombstones_revision CHECK (deleted_revision >= 0)
);

ALTER TABLE word_tombstones ADD COLUMN IF NOT EXISTS legacy_word_id BIGINT;

CREATE TABLE IF NOT EXISTS word_stats (
    id BIGSERIAL PRIMARY KEY,
    word_id BIGINT UNIQUE NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
    seen INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    mastery_level INTEGER NOT NULL DEFAULT 0,
    last_reviewed TIMESTAMPTZ,
    next_review TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_word_stats_seen CHECK (seen >= 0),
    CONSTRAINT ck_word_stats_correct CHECK (correct >= 0),
    CONSTRAINT ck_word_stats_wrong CHECK (wrong >= 0),
    CONSTRAINT ck_word_stats_mastery CHECK (mastery_level BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS wrong_bank (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    word_id BIGINT NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_wrong_bank_user_word UNIQUE (user_id, word_id)
);

CREATE TABLE IF NOT EXISTS quiz_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    wrong_answers INTEGER NOT NULL DEFAULT 0,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    quiz_mode VARCHAR(50) NOT NULL,
    challenge_seconds INTEGER,
    max_combo INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_quiz_total CHECK (total_questions >= 0),
    CONSTRAINT ck_quiz_correct CHECK (correct_answers >= 0),
    CONSTRAINT ck_quiz_wrong CHECK (wrong_answers >= 0),
    CONSTRAINT ck_quiz_score CHECK (score >= 0 AND score <= 10),
    CONSTRAINT ck_quiz_combo CHECK (max_combo >= 0)
);

CREATE TABLE IF NOT EXISTS quiz_history_answers (
    id BIGSERIAL PRIMARY KEY,
    quiz_history_id BIGINT NOT NULL REFERENCES quiz_history(id) ON DELETE CASCADE,
    word_id BIGINT REFERENCES vocabulary(id) ON DELETE SET NULL,
    question_mode VARCHAR(20) NOT NULL,
    prompt TEXT NOT NULL,
    selected_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_attempt (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    attempt_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    quiz_mode VARCHAR(50) NOT NULL,
    challenge_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    submission_fingerprint VARCHAR(64),
    resulting_sync_revision BIGINT,
    quiz_history_id BIGINT,
    awarded_quiz_xp INTEGER,
    result_total_questions INTEGER,
    result_correct_answers INTEGER,
    result_wrong_answers INTEGER,
    result_score DOUBLE PRECISION,
    result_max_combo INTEGER,
    CONSTRAINT fk_learning_attempt_user
        FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_learning_attempt_history
        FOREIGN KEY (quiz_history_id) REFERENCES quiz_history(id),
    CONSTRAINT ux_learning_attempt_id_user UNIQUE (id, user_id),
    CONSTRAINT ck_learning_attempt_type CHECK (attempt_type = 'QUIZ'),
    CONSTRAINT ck_learning_attempt_status CHECK (status IN ('ISSUED', 'CONSUMED')),
    CONSTRAINT ck_learning_attempt_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_learning_attempt_challenge CHECK (
        challenge_seconds IS NULL OR challenge_seconds BETWEEN 0 AND 86400
    ),
    CONSTRAINT ck_learning_attempt_revision CHECK (
        resulting_sync_revision IS NULL OR resulting_sync_revision >= 0
    ),
    CONSTRAINT ck_learning_attempt_result CHECK (
        (status = 'ISSUED'
            AND consumed_at IS NULL
            AND submission_fingerprint IS NULL
            AND resulting_sync_revision IS NULL
            AND quiz_history_id IS NULL
            AND awarded_quiz_xp IS NULL
            AND result_total_questions IS NULL
            AND result_correct_answers IS NULL
            AND result_wrong_answers IS NULL
            AND result_score IS NULL
            AND result_max_combo IS NULL)
        OR
        (status = 'CONSUMED'
            AND consumed_at IS NOT NULL
            AND submission_fingerprint IS NOT NULL
            AND CHAR_LENGTH(submission_fingerprint) = 64
            AND resulting_sync_revision IS NOT NULL
            AND quiz_history_id IS NOT NULL
            AND awarded_quiz_xp IS NOT NULL
            AND result_total_questions IS NOT NULL
            AND result_correct_answers IS NOT NULL
            AND result_wrong_answers IS NOT NULL
            AND result_score IS NOT NULL
            AND result_max_combo IS NOT NULL
            AND awarded_quiz_xp >= 0
            AND result_total_questions > 0
            AND result_correct_answers >= 0
            AND result_wrong_answers >= 0
            AND result_correct_answers + result_wrong_answers = result_total_questions
            AND result_score BETWEEN 0 AND 10
            AND result_max_combo BETWEEN 0 AND result_total_questions
            AND consumed_at >= created_at
            AND consumed_at < expires_at)
    )
);

CREATE TABLE IF NOT EXISTS learning_attempt_item (
    id BIGSERIAL PRIMARY KEY,
    attempt_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    word_id BIGINT,
    word_user_id BIGINT,
    ordinal INTEGER NOT NULL,
    question_mode VARCHAR(20) NOT NULL,
    prompt VARCHAR(255) NOT NULL,
    correct_answer VARCHAR(255) NOT NULL,
    CONSTRAINT fk_learning_attempt_item_attempt
        FOREIGN KEY (attempt_id, user_id)
        REFERENCES learning_attempt(id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_learning_attempt_item_word
        FOREIGN KEY (word_id, word_user_id)
        REFERENCES vocabulary(id, user_id)
        ON DELETE SET NULL,
    CONSTRAINT ux_learning_attempt_item_ordinal UNIQUE (attempt_id, ordinal),
    CONSTRAINT ux_learning_attempt_item_word UNIQUE (attempt_id, word_id),
    CONSTRAINT ck_learning_attempt_item_ordinal CHECK (ordinal BETWEEN 0 AND 499),
    CONSTRAINT ck_learning_attempt_item_mode CHECK (question_mode IN ('eng', 'vie')),
    CONSTRAINT ck_learning_attempt_item_owner CHECK (
        (word_id IS NULL AND word_user_id IS NULL)
        OR (word_id IS NOT NULL AND word_user_id = user_id)
    )
);

CREATE TABLE IF NOT EXISTS achievements (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_achievements_xp CHECK (xp_reward >= 0)
);

ALTER TABLE achievements ADD COLUMN IF NOT EXISTS code VARCHAR(60);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS gender VARCHAR(40);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS learning_goal VARCHAR(160);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS ipa VARCHAR(120);
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS word_level VARCHAR(40);
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS example_meaning TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS collocation TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS synonyms TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS antonyms TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS common_mistake TEXT;
UPDATE achievements
SET code = UPPER(REGEXP_REPLACE(COALESCE(NULLIF(name, ''), 'ACHIEVEMENT_' || id::TEXT), '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL;
ALTER TABLE achievements ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_achievements_code ON achievements(code);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    achievement_id BIGINT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- Additive schema repair for databases that were created before later app fields existed.
-- CREATE TABLE IF NOT EXISTS does not update existing Supabase/PostgreSQL tables.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'USER';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS word_uid UUID;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS eng VARCHAR(255);
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS vie VARCHAR(255);
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS pos VARCHAR(50) DEFAULT 'n';
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS tag VARCHAR(100);
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS mastered BOOLEAN DEFAULT FALSE;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE vocabulary
SET word_uid = (
    SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 1 FOR 8) || '-' ||
    SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 9 FOR 4) || '-' ||
    '4' || SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 14 FOR 3) || '-' ||
    '8' || SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 18 FOR 3) || '-' ||
    SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 21 FOR 12)
)::UUID
WHERE word_uid IS NULL AND user_id IS NOT NULL AND id IS NOT NULL;

ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS word_id BIGINT REFERENCES vocabulary(id) ON DELETE CASCADE;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS seen INTEGER DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS correct INTEGER DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS wrong INTEGER DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS mastery_level INTEGER DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS last_reviewed TIMESTAMPTZ;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS next_review TIMESTAMPTZ;
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE word_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_word_uid ON vocabulary(user_id, word_uid);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_lower_eng ON vocabulary(user_id, LOWER(eng));
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_tag ON vocabulary(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_word_stats_next_review ON word_stats(next_review);
CREATE INDEX IF NOT EXISTS idx_wrong_bank_user ON wrong_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_user_created ON quiz_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_history ON quiz_history_answers(quiz_history_id);
CREATE INDEX IF NOT EXISTS idx_word_tombstones_user_revision ON word_tombstones(user_id, deleted_revision);
CREATE INDEX IF NOT EXISTS idx_word_tombstones_user_legacy_word_id ON word_tombstones(user_id, legacy_word_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON app_users;
CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vocabulary_updated_at ON vocabulary;
CREATE TRIGGER trg_vocabulary_updated_at
BEFORE UPDATE ON vocabulary
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_word_stats_updated_at ON word_stats;
CREATE TRIGGER trg_word_stats_updated_at
BEFORE UPDATE ON word_stats
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_wrong_bank_updated_at ON wrong_bank;
CREATE TRIGGER trg_wrong_bank_updated_at
BEFORE UPDATE ON wrong_bank
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO achievements (code, name, description, xp_reward) VALUES
    ('FIRST_WORD', 'First Word', 'Add your first vocabulary word.', 10),
    ('FIRST_QUIZ', 'First Quiz', 'Complete your first quiz round.', 20),
    ('PERFECT_ROUND', 'Perfect Round', 'Finish a quiz with every answer correct.', 50),
    ('COMBO_10', 'Combo 10', 'Reach a 10-answer combo.', 40),
    ('DAILY_CHALLENGE', 'Daily Challenger', 'Complete a daily challenge.', 30)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    xp_reward = EXCLUDED.xp_reward;
