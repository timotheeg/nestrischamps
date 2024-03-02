// Sample Attendee Sheet
// https://docs.google.com/spreadsheets/d/13ylAk77UR_5V3zyVxpAlYFiHtouKiIoQu9DVOcyTibM/edit?usp=sharing
// 1. Make a copy
// 2. Fill it
// 3. Publish Sheet 1 to Web as CSV
// 4. update the sheet csv export URL below
// 5. run script as:
// node scripts/insert_local_users.js

import pg from 'pg';
import { parse } from 'csv-parse/sync';
import ULID from 'ulid';
import got from 'got';

// replace this URL by the sheet that contains your data
// get the url by doing: File > Share > Publish to web > Sheet 1 > CSV
const sheet_csv_url =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vTnEyEvhOVg6shbkhpex4L_diKZ_EfAlLJd0-8MEd1rfT0-uh-zAO07iv05CXC0c6ItvRCigiGLgGpX/pub?gid=0&single=true&output=csv';

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

	const records_csv_content = await got(sheet_csv_url).text();
	const records = parse(records_csv_content, {
		skip_empty_lines: true,
	});

	await pool.query('DELETE FROM scores WHERE player_id>32 AND frame_file is NULL or frame_file = \'\'');
	await pool.query('DELETE FROM twitch_users WHERE id>32');

	records.shift(); // drop header row from csv

	let id = 33;

	for (const record of records) {
		const [
			seed,
			login,
			display_name,
			pronouns,
			personal_best,
			elo_rank,
			elo_rating,
			description,
			dob,
			country_code,
			city,
			interests,
			style,
			profile_image_url,
		] = record;

		console.log(record);

		await pool.query(
			`INSERT INTO twitch_users
			(id, login, email, secret, description, display_name, pronouns, profile_image_url, dob, country_code, city, interests, style, elo_rank, elo_rating, created_on, last_login)
			VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
			`,
			[
				id,
				/^\s*$/.test(login) ? `__user${id}` : login,
				`__user${id}@nestrischamps.io`,
				ULID.ulid(),
				description,
				`${seed}. ${display_name}`,
				pronouns,
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
