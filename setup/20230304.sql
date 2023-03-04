ALTER TABLE scores ADD COLUMN competition BOOLEAN default false;
DROP INDEX IDX_scores_manual_scores;
CREATE UNIQUE INDEX IDX_scores_manual_scores on scores (player_id, start_level, competition) where manual;