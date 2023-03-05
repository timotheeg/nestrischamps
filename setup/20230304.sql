ALTER TABLE scores ADD COLUMN competition BOOLEAN default false;

DROP INDEX IDX_scores_manual_scores;

CREATE UNIQUE INDEX IDX_scores_manual_scores on scores (player_id, start_level, competition) where manual;
CREATE INDEX IDX_scores_player_level_competition ON scores (player_id, start_level, competition);
CREATE INDEX IDX_scores_player_session ON scores (player_id, session);
CREATE INDEX IDX_scores_player_level ON scores (player_id, start_level);
