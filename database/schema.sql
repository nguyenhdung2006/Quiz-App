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
    eng VARCHAR(255) NOT NULL,
    vie VARCHAR(255) NOT NULL,
    pos VARCHAR(50) NOT NULL DEFAULT 'n',
    tag VARCHAR(100),
    example TEXT,
    note TEXT,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_vocabulary_user_eng UNIQUE (user_id, eng),
    CONSTRAINT ck_vocabulary_eng_not_blank CHECK (BTRIM(eng) <> ''),
    CONSTRAINT ck_vocabulary_vie_not_blank CHECK (BTRIM(vie) <> '')
);

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

CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_lower_eng ON vocabulary(user_id, LOWER(eng));
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_tag ON vocabulary(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_word_stats_next_review ON word_stats(next_review);
CREATE INDEX IF NOT EXISTS idx_wrong_bank_user ON wrong_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_user_created ON quiz_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_history ON quiz_history_answers(quiz_history_id);

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
