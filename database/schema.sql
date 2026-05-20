CREATE TABLE IF NOT EXISTS vocab_words (
    id BIGSERIAL PRIMARY KEY,
    eng TEXT NOT NULL,
    vie TEXT NOT NULL,
    pos VARCHAR(40) NOT NULL DEFAULT 'n',
    tag VARCHAR(120),
    example TEXT,
    note TEXT,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    seen INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vocab_words_eng_lower
    ON vocab_words (LOWER(eng));

CREATE TABLE IF NOT EXISTS wrong_words (
    id BIGSERIAL PRIMARY KEY,
    eng TEXT NOT NULL,
    vie TEXT NOT NULL,
    pos VARCHAR(40) NOT NULL DEFAULT 'n',
    tag VARCHAR(120),
    example TEXT,
    note TEXT,
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wrong_words_eng_lower
    ON wrong_words (LOWER(eng));
