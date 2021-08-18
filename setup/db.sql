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

	country_code VARCHAR( 2 ) default 'US',
	interests VARCHAR ( 300 ) default '',
	style play_style default 'das',

	created_on TIMESTAMP NOT NULL,
	last_login TIMESTAMP NOT NULL
);

CREATE INDEX IDX_users_email ON twitch_users (email);

CREATE TABLE scores (
	id SERIAL PRIMARY KEY,
	datetime TIMESTAMP NOT NULL,
	player_id BIGINT NOT NULL,
	start_level SMALLINT,
	end_level SMALLINT,
	score INTEGER,
	lines SMALLINT,
	tetris_rate NUMERIC(10,9),
	num_droughts SMALLINT,
	max_drought SMALLINT,
	das_avg NUMERIC(10,8),
	duration INTEGER DEFAULT 0,
	clears VARCHAR(400) DEFAULT '',
	pieces VARCHAR(1200) DEFAULT '',
	transition INTEGER DEFAULT NULL,
	num_frames INTEGER DEFAULT 0,
	frame_file VARCHAR(256) DEFAULT '',
	manual BOOLEAN default 0,

	CONSTRAINT fk_player
		FOREIGN KEY(player_id)
			REFERENCES twitch_users(id)
);

CREATE INDEX IDX_scores_player_datetime ON scores (player_id, datetime);
CREATE INDEX IDX_scores_player_score ON scores (player_id, score);
CREATE INDEX IDX_scores_datetime ON scores (datetime);

CREATE TABLE sessions (
	sid varchar NOT NULL COLLATE "default",
	sess json NOT NULL,
	expire timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IDX_session_expire ON sessions (expire);

INSERT INTO twitch_users VALUES (1, 'player1', 'player1@nestrischamps.com', 'PLAYER1', '', '', 'Player 1', '', NOW(), NOW());
INSERT INTO twitch_users VALUES (2, 'player2', 'player2@nestrischamps.com', 'PLAYER2', '', '', 'Player 2', '', NOW(), NOW());
INSERT INTO twitch_users VALUES (3, 'player3', 'player3@nestrischamps.com', 'PLAYER3', '', '', 'Player 3', '', NOW(), NOW());
INSERT INTO twitch_users VALUES (4, 'player4', 'player4@nestrischamps.com', 'PLAYER4', '', '', 'Player 4', '', NOW(), NOW());

