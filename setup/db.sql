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

	elo_rank INTEGER NOT NULL DEFAULT 0,
	elo_rating DOUBLE PRECISION NOT NULL DEFAULT 0,

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


INSERT INTO twitch_users
(id, login, email, secret, type, description, display_name, profile_image_url, dob, country_code, city, interests, style, timezone, created_on, last_login)
VALUES
(1,  'player1',  'player1@nestrischamps.io',  'PLAYER1',  '', '', 'Player 1',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(2,  'player2',  'player2@nestrischamps.io',  'PLAYER2',  '', '', 'Player 2',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(3,  'player3',  'player3@nestrischamps.io',  'PLAYER3',  '', '', 'Player 3',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(4,  'player4',  'player4@nestrischamps.io',  'PLAYER4',  '', '', 'Player 4',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(5,  'player5',  'player5@nestrischamps.io',  'PLAYER5',  '', '', 'Player 5',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(6,  'player6',  'player6@nestrischamps.io',  'PLAYER6',  '', '', 'Player 6',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(7,  'player7',  'player7@nestrischamps.io',  'PLAYER7',  '', '', 'Player 7',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(8,  'player8',  'player8@nestrischamps.io',  'PLAYER8',  '', '', 'Player 8',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(9,  'player9',  'player9@nestrischamps.io',  'PLAYER9',  '', '', 'Player 9',  '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(10, 'player10', 'player10@nestrischamps.io', 'PLAYER10', '', '', 'Player 10', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(11, 'player11', 'player11@nestrischamps.io', 'PLAYER11', '', '', 'Player 11', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(12, 'player12', 'player12@nestrischamps.io', 'PLAYER12', '', '', 'Player 12', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(13, 'player13', 'player13@nestrischamps.io', 'PLAYER13', '', '', 'Player 13', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(14, 'player14', 'player14@nestrischamps.io', 'PLAYER14', '', '', 'Player 14', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(15, 'player15', 'player15@nestrischamps.io', 'PLAYER15', '', '', 'Player 15', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(16, 'player16', 'player16@nestrischamps.io', 'PLAYER16', '', '', 'Player 16', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(17, 'player17', 'player17@nestrischamps.io', 'PLAYER17', '', '', 'Player 17', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(18, 'player18', 'player18@nestrischamps.io', 'PLAYER18', '', '', 'Player 18', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(19, 'player19', 'player19@nestrischamps.io', 'PLAYER19', '', '', 'Player 19', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(20, 'player20', 'player20@nestrischamps.io', 'PLAYER20', '', '', 'Player 20', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(21, 'player21', 'player21@nestrischamps.io', 'PLAYER21', '', '', 'Player 21', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(22, 'player22', 'player22@nestrischamps.io', 'PLAYER22', '', '', 'Player 22', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(23, 'player23', 'player23@nestrischamps.io', 'PLAYER23', '', '', 'Player 23', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(24, 'player24', 'player24@nestrischamps.io', 'PLAYER24', '', '', 'Player 24', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(25, 'player25', 'player25@nestrischamps.io', 'PLAYER25', '', '', 'Player 25', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(26, 'player26', 'player26@nestrischamps.io', 'PLAYER26', '', '', 'Player 26', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(27, 'player27', 'player27@nestrischamps.io', 'PLAYER27', '', '', 'Player 27', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(28, 'player28', 'player28@nestrischamps.io', 'PLAYER28', '', '', 'Player 28', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(29, 'player29', 'player29@nestrischamps.io', 'PLAYER29', '', '', 'Player 29', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(30, 'player30', 'player30@nestrischamps.io', 'PLAYER30', '', '', 'Player 30', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(31, 'player31', 'player31@nestrischamps.io', 'PLAYER31', '', '', 'Player 31', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW()),
(32, 'player32', 'player32@nestrischamps.io', 'PLAYER32', '', '', 'Player 32', '', NOW(), '', '', '', 'das', 'UTC', NOW(), NOW());
