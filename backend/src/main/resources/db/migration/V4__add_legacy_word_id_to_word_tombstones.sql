ALTER TABLE word_tombstones
ADD COLUMN legacy_word_id BIGINT;

CREATE INDEX idx_word_tombstones_user_legacy_word_id
ON word_tombstones(user_id, legacy_word_id);
