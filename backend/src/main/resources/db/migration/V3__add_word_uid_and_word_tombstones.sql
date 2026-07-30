ALTER TABLE vocabulary
ADD COLUMN word_uid UUID;

UPDATE vocabulary
SET word_uid = (
    SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 1 FOR 8) || '-' ||
    SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 9 FOR 4) || '-' ||
    '4' || SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 14 FOR 3) || '-' ||
    '8' || SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 18 FOR 3) || '-' ||
    SUBSTRING(MD5(user_id::TEXT || ':' || id::TEXT) FROM 21 FOR 12)
)::UUID
WHERE word_uid IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM vocabulary WHERE word_uid IS NULL) THEN
        RAISE EXCEPTION 'V3 migration failed: vocabulary.word_uid contains NULL values after backfill';
    END IF;
END;
$$;

ALTER TABLE vocabulary
ALTER COLUMN word_uid SET NOT NULL;

ALTER TABLE vocabulary
ADD CONSTRAINT ux_vocabulary_user_word_uid UNIQUE (user_id, word_uid);

CREATE TABLE word_tombstones (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    word_uid UUID NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL,
    deleted_revision BIGINT NOT NULL,
    CONSTRAINT fk_word_tombstones_user
        FOREIGN KEY (user_id)
        REFERENCES app_users(id)
        ON DELETE CASCADE,
    CONSTRAINT ux_word_tombstones_user_word_uid
        UNIQUE (user_id, word_uid),
    CONSTRAINT ck_word_tombstones_revision
        CHECK (deleted_revision >= 0)
);

CREATE INDEX idx_word_tombstones_user_revision
ON word_tombstones(user_id, deleted_revision);
