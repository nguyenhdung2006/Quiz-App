CREATE TABLE review_operation (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    word_id BIGINT NOT NULL,
    target_word_id BIGINT,
    target_user_id BIGINT,
    action VARCHAR(20) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL,
    mastery INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    next_review TIMESTAMPTZ NOT NULL,
    message VARCHAR(100) NOT NULL,
    resulting_revision BIGINT NOT NULL,
    CONSTRAINT fk_review_operation_word FOREIGN KEY (target_word_id, target_user_id)
        REFERENCES vocabulary(id, user_id) ON DELETE SET NULL,
    CONSTRAINT ck_review_operation_owner CHECK (
        (target_word_id IS NULL AND target_user_id IS NULL)
        OR (target_word_id IS NOT NULL AND target_user_id IS NOT NULL
            AND target_word_id = word_id AND target_user_id = user_id)
    ),
    CONSTRAINT ck_review_operation_action CHECK (action IN ('review', 'mark-hard', 'known')),
    CONSTRAINT ck_review_operation_fingerprint CHECK (CHAR_LENGTH(fingerprint) = 64),
    CONSTRAINT ck_review_operation_result CHECK (
        word_id > 0 AND mastery BETWEEN 0 AND 100 AND MOD(mastery, 20) = 0
        AND streak BETWEEN 0 AND 1000000 AND resulting_revision > 0
        AND consumed_at >= created_at AND next_review > consumed_at
    )
);
-- FK parent deletion checks; normal replay lookup uses the UUID primary key.
CREATE INDEX ix_review_operation_user ON review_operation(user_id);
CREATE INDEX ix_review_operation_word ON review_operation(target_word_id, target_user_id);
-- Physical retention cleanup is deferred to Finding 12's lifecycle batch.
