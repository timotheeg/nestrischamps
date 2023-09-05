// Sample Attendee Sheet
// https://docs.google.com/spreadsheets/d/13ylAk77UR_5V3zyVxpAlYFiHtouKiIoQu9DVOcyTibM/edit?usp=sharing
// 1. Make a copy
// 2. Fill it
// 3. Download as csv
// 4 run script as:
// node scripts/insert_local_users.js attendees.csv

import pg from 'pg';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import ULID from 'ulid';

(async function () {
	const db_conn_str = process.env.DATABASE_URL;
	const db_url = new URL(db_conn_str);

	if (!/^(192\.168(\.\d{1,3}){2}|localhost)$/.test(db_url.hostname)) {
		console.log('DB is not localhost or LAN IP, not proceeding');
		process.exit(1);
	}

	const pool = new pg.Pool({
		connectionString: db_conn_str,
	});

	const records_file = process.argv[2];
	const records = parse(fs.readFileSync(records_file), {
		skip_empty_lines: true,
	});

	await pool.query('DELETE FROM scores WHERE player_id>32');
	await pool.query('DELETE FROM twitch_users WHERE id>32');

	records.shift(); // drop header row from csv

	let id = 33;

	for (const record of records) {
		const [
			seed,
			login,
			display_name,
			personal_best,
			elo_rank,
			elo_rating,
			description,
			profile_image_url,
			dob,
			country_code,
			city,
			interests,
			style,
		] = record;

		console.log(record);

		await pool.query(
			`INSERT INTO twitch_users
			(id, login, email, secret, description, display_name, profile_image_url, dob, country_code, city, interests, style, elo_rank, elo_rating, created_on, last_login)
			VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
			`,
			[
				id,
				/^\s*$/.test(login) ? `__user${id}` : login,
				`__user${id}@nestrischamps.io`,
				ULID.ulid(),
				description,
				`${seed}. ${display_name}`,
				profile_image_url,
				dob,
				country_code,
				city,
				interests,
				style,
				elo_rank,
				elo_rating,
			]
		);

		await pool.query(
			`
			INSERT INTO scores
			(
				datetime,

				player_id,
				start_level,
				end_level,
				score,

				competition,
                manual,
				lines,
				tetris_rate,
				num_droughts,
				max_drought,
				das_avg,
				duration,
				clears,
				pieces,
				transition,
				num_frames,
				frame_file
			)
			VALUES
			(
				NOW(),
                $1, $2, $3, $4,
                false, true, 0, 0, 0, 0, -1, 0, '', '', 0, 0, ''
			)
			`,
			[id, 18, 18, parseInt(personal_best, 10)]
		);

		id++;
	}

	process.exit(0);
})();
