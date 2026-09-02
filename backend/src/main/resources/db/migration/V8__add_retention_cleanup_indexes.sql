CREATE INDEX ix_learning_attempt_retention_consumed
    ON learning_attempt(status, consumed_at, id);

CREATE INDEX ix_learning_attempt_retention_expired
    ON learning_attempt(status, expires_at, id);

CREATE INDEX ix_review_operation_retention_consumed
    ON review_operation(consumed_at, id);
