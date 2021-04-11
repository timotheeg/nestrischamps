CREATE TABLE twitch_users (
	id BIGINT PRIMARY KEY,
	login VARCHAR ( 25 ) UNIQUE NOT NULL,
	email VARCHAR ( 255 ) NOT NULL,

	secret VARCHAR ( 36 ) UNIQUE NOT NULL,

	type VARCHAR ( 128 ),
	description TEXT,
	display_name VARCHAR ( 255 ),
	profile_image_url VARCHAR ( 255 ),

	created_on TIMESTAMP NOT NULL,
	last_login TIMESTAMP NOT NULL
);

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

	CONSTRAINT fk_player
		FOREIGN KEY(player_id)
			REFERENCES twitch_users(id)
);

INSERT INTO twitch_users VALUES (1, 'player1', 'player1@nestrischamps.com', 'player1', '', '', 'Player 1', '', NOW(), NOW());
INSERT INTO twitch_users VALUES (2, 'player2', 'player2@nestrischamps.com', 'player2', '', '', 'Player 2', '', NOW(), NOW());