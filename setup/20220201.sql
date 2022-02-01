-- update for score analytics with timezones

ALTER TABLE scores
	ALTER COLUMN datetime TYPE timestamptz;

ALTER TABLE twitch_users
	ALTER COLUMN created_on TYPE timestamptz,
	ALTER COLUMN last_login TYPE timestamptz,
	ADD COLUMN timezone TEXT NOT NULL CHECK (now() AT TIME ZONE timezone IS NOT NULL) DEFAULT 'UTC';
