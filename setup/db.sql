CREATE TYPE play_style AS ENUM ('das', 'tap', 'roll', 'hybrid');

CREATE TABLE twitch_users (
	id BIGINT PRIMARY KEY,
	login VARCHAR ( 25 ) UNIQUE NOT NULL,
	email VARCHAR ( 255 ) NOT NULL,

	secret VARCHAR ( 36 ) UNIQUE NOT NULL,

	type VARCHAR ( 128 ),
	description TEXT,
	display_name VARCHAR ( 255 ),
	profile_image_url VARCHAR ( 255 ),

	dob date,
	country_code VARCHAR( 2 ),
	city VARCHAR( 100 ),
	interests VARCHAR ( 300 ) default '',
	style play_style default 'das',
	timezone TEXT NOT NULL CHECK (now() AT TIME ZONE timezone IS NOT NULL) DEFAULT 'UTC',

	created_on timestamptz NOT NULL,
	last_login timestamptz NOT NULL
);

CREATE INDEX IDX_users_email ON twitch_users (email);

CREATE TABLE scores (
	id SERIAL PRIMARY KEY,
	datetime timestamptz NOT NULL,
	player_id BIGINT NOT NULL,
	session INTEGER DEFAULT 1,
	start_level SMALLINT,
	end_level SMALLINT,
	score INTEGER,
	lines SMALLINT,
	tetris_rate DOUBLE PRECISION,
	num_droughts SMALLINT,
	max_drought SMALLINT,
	das_avg DOUBLE PRECISION,
	duration INTEGER DEFAULT 0,
	clears VARCHAR(600) DEFAULT '',
	pieces VARCHAR(2400) DEFAULT '',
	transition INTEGER DEFAULT NULL,
	num_frames INTEGER DEFAULT 0,
	frame_file VARCHAR(256) DEFAULT '',
	competition BOOLEAN default false,
	manual BOOLEAN default false,

	CONSTRAINT fk_player
		FOREIGN KEY(player_id)
			REFERENCES twitch_users(id)
);

CREATE UNIQUE INDEX IDX_scores_manual_scores on scores (player_id, start_level, competition) where manual;
CREATE INDEX IDX_scores_player_level_competition ON scores (player_id, start_level, competition);
CREATE INDEX IDX_scores_player_score ON scores (player_id, score);
CREATE INDEX IDX_scores_player_session ON scores (player_id, session);
CREATE INDEX IDX_scores_player_level ON scores (player_id, start_level);
CREATE INDEX IDX_scores_player_datetime ON scores (player_id, datetime);
CREATE INDEX IDX_scores_datetime ON scores (datetime);

CREATE TABLE sessions (
	sid varchar NOT NULL COLLATE "default",
	sess json NOT NULL,
	expire timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IDX_session_expire ON sessions (expire);

INSERT INTO twitch_users VALUES (1, 'player1', 'player1@nestrischamps.io', 'PLAYER1', '', '', 'Player 1', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW());
INSERT INTO twitch_users VALUES (2, 'player2', 'player2@nestrischamps.io', 'PLAYER2', '', '', 'Player 2', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW());
INSERT INTO twitch_users VALUES (3, 'player3', 'player3@nestrischamps.io', 'PLAYER3', '', '', 'Player 3', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW());
INSERT INTO twitch_users VALUES (4, 'player4', 'player4@nestrischamps.io', 'PLAYER4', '', '', 'Player 4', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW());

