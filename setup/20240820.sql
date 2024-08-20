ALTER INDEX twitch_users_pkey RENAME TO users_pkey;
ALTER INDEX twitch_users_login_key RENAME TO users_login_key;
ALTER INDEX twitch_users_secret_key RENAME TO users_secret_key;
ALTER TABLE users RENAME CONSTRAINT twitch_users_timezone_check TO users_timezone_check;
