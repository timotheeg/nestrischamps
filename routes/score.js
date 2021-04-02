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


router.post('/report_game/:secret', express.json(), async (req, res) => {
	console.log('Reporting game by secret');

	const user = await UserDAO.getUserBySecret(req.params.secret);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	console.log(`Found user ${user.login}`);

	let game_data = req.body;
	let normalized_report;

	try {
		normalized_report = {
			start_level:  game_data.start_level,
			end_level:    game_data.level,
			score:        game_data.score.current    || 0,
			lines:        game_data.lines.count      || 0,
			tetris_rate:  game_data.lines[4].percent || 0,
			num_droughts: game_data.i_droughts.count || 0,
			max_drought:  game_data.i_droughts.max   || 0,
			das_avg:      game_data.das.avg          || 0,
			duration:     game_data.duration         || 0,
		};

		if (game_data.timeline) {
			normalized_report.clears = game_data.timeline.clears || '';
			normalized_report.pieces = game_data.timeline.pieces || '';
		}
	}
	catch (err) {
		console.error('Invalid game data');
		res.status(400).send('Invalid Game Data');
		return;
	}

	console.log('Game data is good');

	try {
		await ScoreDAO.recordGame(user, normalized_report);
	}
	catch(err) {
		console.log('Unable to record game');
		console.error(err);
	}

	console.log('Game is recorded!');

	res.json(await ScoreDAO.getStats(user));

	console.log('Sent new scores back');
});

router.get('/scores', middlewares.assertSession, async (req, res) => {
	console.log(`Fetching user scores for ${req.session.user.id}`);

	const PAGE_SIZE = 100;
	const ALLOWED_ORDER_FIELDS = ['datetime', 'score', 'tetris_rate'];
	const ALLOWED_ORDER_DIRS = ['desc', 'asc'];

	const options = {
		sort_field: 'id',
		sort_order: 'desc',
		page_idx: 0,
	};

	// validate and get args from query
	if (ALLOWED_ORDER_FIELDS.includes(req.query.sort_field)) {
		options.sort_field = req.query.sort_field;
	}

	if (ALLOWED_ORDER_DIRS.includes(req.query.sort_order)) {
		options.sort_order = req.query.sort_order;
	}

	if (/^\d+$/.test(req.query.page_idx)) {
		options.page_idx = parseInt(req.query.page_idx, 10);
	}

	const num_scores = await ScoreDAO.getNumberOfScores(req.session.user);
	const num_pages = Math.floor(num_scores / PAGE_SIZE);

	options.page_idx = Math.max(0, Math.min(options.page_idx, num_pages));

	// WARNING: when we supply pagination parameters here, all field MUST be sanitized because inerpolates them in plain JS
	const scores = await ScoreDAO.getScorePage(req.session.user, options);

	res.render('scores', {
		scores,
		pagination: options,
		num_pages: num_pages + 1
	});
});

router.get('/scores/:id', middlewares.assertSession, async (req, res) => {
	const score = await ScoreDAO.deleteScore(req.session.user, req.params.id);

	res.json(score);
});

router.delete('/scores/:id', middlewares.assertSession, async (req, res) => {
	console.log(`User ${req.session.user.id} is deleting score ${req.params.id}`);

	await ScoreDAO.deleteScore(req.session.user, req.params.id);

	res.json({ status: 'ok' });
});

module.exports = router;