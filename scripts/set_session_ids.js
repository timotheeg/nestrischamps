import dbPool from '../modules/db.js';
import _ from 'lodash';

const SESSION_BREAK_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_IDS_PER_UPDATE = 100;

async function setSessionInGames(db_client, playerid, sessionid, gameids) {
	if (gameids.length <= 0) return;

	for (const id_chunk of _.chunk(gameids, MAX_IDS_PER_UPDATE)) {
		console.log('Updating session', playerid, sessionid);
		console.log(id_chunk);

		// return; // DRY RUN, uncomment to activate mutations

		await db_client.query(
			`
			UPDATE scores
			SET session=$1
			WHERE
				player_id=$2
				AND id IN (${id_chunk.join(',')})
			`,
			[sessionid, playerid]
		);
	}
}

async function run() {
	const db_client = await dbPool.connect();

	let players = (
		await db_client.query(
			`
		SELECT id, login from twitch_users
		`
		)
	).rows;

	console.log(`Retrieved ${players.length} players`);

	for (const { id: playerid, login } of players) {
		console.log(`Setting session ids for player ${login} (${playerid})`);

		let scores = (
			await db_client.query(
				`
				SELECT id, datetime
				FROM scores
				WHERE player_id=$1
				ORDER BY datetime asc
			`,
				[playerid]
			)
		).rows;

		console.log(`Retrieved ${scores.length} scores for ${login}`);

		let session = 1;
		let session_games = [];
		let last_game_time = null;

		for (const { id: scoreid, datetime } of scores) {
			if (
				last_game_time === null ||
				datetime - last_game_time < SESSION_BREAK_MS
			) {
				session_games.push(scoreid);
				last_game_time = datetime;
				continue;
			}

			await setSessionInGames(db_client, playerid, session, session_games);

			session += 1;
			session_games = [scoreid];
			last_game_time = datetime;
		}

		// save last batch
		await setSessionInGames(db_client, playerid, session, session_games);
	}
}

async function start() {
	const startTime = Date.now();
	await run();
	console.log(`Run in ${Date.now() - startTime}ms`);
}

start().then(() => process.exit(0));
