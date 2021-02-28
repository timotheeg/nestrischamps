const dbPool = require('../modules/db');

class ScoreDAO {
	constructor() {}

	async getStats(user) {
		const db_client = await dbPool.connect();

		return {
			current_player: user.login,
			pbs: [
				await this._getPBs(db_client, user, 18),
				await this._getPBs(db_client, user, 19),
			],
			high_scores: {
				overall: await this._getBestOverall(db_client, user),
				today:   await this._getBestToday(db_client, user)
			}
		};
	}

	async _getPBs(db_client, user, start_level) {
		const result = await db_client.query(`
			SELECT start_level, end_level, score, lines, das_avg, tetris_rate
			FROM scores
			WHERE player_id=$1 and start_level=$2
			ORDER BY score DESC
			LIMIT 1
			`,
			[
				user.id, start_level
			]
		);

		return result.rows[0];
	}

	async _getBestOverall(db_client, user) {
		const result = await db_client.query(`
			SELECT start_level, score, tetris_rate
			FROM scores
			WHERE player_id=$1
			ORDER BY score DESC
			LIMIT 7
			`,
			[ user.id ]
		);

		return result.rows;
	}

	async _getBestToday(db_client, user) {
		const now = new Date();
		const today = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate()
		);

		const result = await db_client.query(`
			SELECT start_level, score, tetris_rate
			FROM scores
			WHERE player_id=$1
				AND datetime>=$2
			ORDER BY score DESC
			LIMIT 7
			`,
			[
				user.id,
				today.toISOString(),
			]
		);

		return result.rows;
	}

	async reportGame(user, game_data) {
		if (!game_data) return;

		const db_client = await dbPool.connect();

		const result = await db_client.query(`
			INSERT INTO scores
			(
				datetime,
				player_id,
				start_level,
				end_level,
				score,
				lines,
				tetris_rate,
				num_droughts,
				max_drought,
				das_avg
			)
			VALUES
			(
				NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9
			)
			`,
			[
				user.id,
				game_data.player_id,
				game_data.start_level,
				game_data.end_level,
				game_data.score        || 0,
				game_data.lines        || 0,
				game_data.tetris_rate  || 0,
				game_data.num_droughts || 0,
				game_data.max_drought  || 0,
				game_data.das_avg      || 0
			]
		);

		return await ScoreDAO.getStats(user);
	}
}

module.exports = new ScoreDAO();

