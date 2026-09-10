ALTER TABLE vocabulary
ADD CONSTRAINT ux_vocabulary_id_user UNIQUE (id, user_id);

CREATE TABLE learning_attempt (
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

CREATE TABLE learning_attempt_item (
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
