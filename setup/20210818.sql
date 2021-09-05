-- update for user profile support

CREATE TYPE play_style AS ENUM ('das', 'tap', 'roll', 'hybrid');
ALTER TABLE twitch_users
	ADD COLUMN dob date,
	ADD COLUMN country_code VARCHAR(2) DEFAULT 'US',
	ADD COLUMN city VARCHAR(100),
	ADD COLUMN style play_style DEFAULT 'das',
	ADD COLUMN interests VARCHAR(300) DEFAULT '';

ALTER TABLE scores ADD COLUMN manual BOOLEAN default false;
CREATE UNIQUE INDEX IDX_scores_manual_scores on scores (player_id, start_level) where manual;