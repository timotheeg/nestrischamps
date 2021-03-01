const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');
const UserDAO = require('../daos/UserDAO');
const ScoreDAO = require('../daos/ScoreDAO');

router.get('/get_stats/:secret', async (req, res) => {
	console.log('get stats by secret');

	const user = await UserDAO.getUserBySecret(req.params.secret);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.json(await ScoreDAO.getStats(user));
});

router.get('/u/:login/get_stats', middlewares.assertSession, async (req, res) => {
	console.log('get stats by login');

	const user = await UserDAO.getUserByLogin(req.params.login);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.json(await ScoreDAO.getStats(user));
});

router.get('/get_stats', middlewares.assertSession, async (req, res) => {
	console.log('get stats by session');

	const user = await UserDAO.getUserById(req.session.user.id);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.json(await ScoreDAO.getStats(user));
});


router.post('/report_game/:secret', middlewares.assertSession, express.json(), async (req, res) => {
	console.log('report_game by secret');

	const user = await UserDAO.getUserBySecret(req.params.secret);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	let game_data = req.body;

	try {
		game_data = {
			start_level:  game_data.start_level,
			end_level:    game_data.level,
			score:        game_data.score.current    || 0,
			lines:        game_data.lines.count      || 0,
			tetris_rate:  game_data.lines[4].percent || 0,
			num_droughts: game_data.i_droughts.count || 0,
			max_drought:  game_data.i_droughts.max   || 0,
			das_avg:      game_data.das.avg          || 0
		};
	}
	catch (err) {
		console.error('Invalid game data');
		res.status(400).send('Invalid Game Data');
		return;
	}

	try {
		await ScoreDAO.recordGame(user, game_data);
	}
	catch(err) {
		console.log('Unable to record game');
		console.error(err);
	}

	res.json(await ScoreDAO.getStats(user));
});

module.exports = router;