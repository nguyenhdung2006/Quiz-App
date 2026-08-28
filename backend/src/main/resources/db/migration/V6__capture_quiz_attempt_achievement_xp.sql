ALTER TABLE learning_attempt
    ADD COLUMN awarded_achievement_xp INTEGER;

UPDATE learning_attempt
SET awarded_achievement_xp = 0
WHERE status = 'CONSUMED';

ALTER TABLE learning_attempt
    ADD CONSTRAINT ck_learning_attempt_achievement_xp CHECK (
        (status = 'ISSUED' AND awarded_achievement_xp IS NULL)
        OR
        (status = 'CONSUMED' AND awarded_achievement_xp IS NOT NULL AND awarded_achievement_xp >= 0)
    );
