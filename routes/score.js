const path = require('path');
const express = require('express');
const router = express.Router();

const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");


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

	/*
	// Game is reported server-ide now, no need to record here

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
			transition:   game_data.score.transition || null,
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
	/**/

	res.json(await ScoreDAO.getStats(user));

	console.log('Sent new scores back');
});

router.get('/scores', middlewares.assertSession, async (req, res) => {
	console.log(`Fetching user scores for ${req.session.user.id}`);

	const PAGE_SIZE = 100;
	const ALLOWED_ORDER_FIELDS = ['datetime', 'score', 'tetris_rate'];
	const ALLOWED_ORDER_DIRS = ['desc', 'asc'];

	const options = {
		sort_field: 'datetime',
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
	const num_pages = Math.ceil(num_scores / PAGE_SIZE) || 1;

	options.page_idx = Math.max(0, Math.min(options.page_idx, num_pages - 1));

	// WARNING: when we supply pagination parameters here, all field MUST be sanitized because inerpolates them in plain JS
	const scores = await ScoreDAO.getScorePage(req.session.user, options);

	res.render('scores', {
		scores,
		num_pages,
		pagination: options,
	});
});

router.get('/scores/:id', middlewares.assertSession, async (req, res) => {
	console.log(`User ${req.session.user.id} is getting score ${req.params.id}`);
	const score = await ScoreDAO.getScore(req.session.user, req.params.id);

	if (score) {
		if (score.frame_file) {
			score.frame_file_url = `${process.env.GAME_FRAMES_BASEURL}${score.frame_file}`;

			delete score.frame_file;
		}
	}

	res.json(score);
});

router.delete('/scores/:id', middlewares.assertSession, async (req, res) => {
	console.log(`User ${req.session.user.id} is deleting score ${req.params.id}`);

	const score = await ScoreDAO.getScore(req.session.user, req.params.id);

	await ScoreDAO.deleteScore(req.session.user, req.params.id);

	if (score && score.frame_file) {
		const s3_client = new S3Client({ region: process.env.GAME_FRAMES_REGION });

		// fire and forget...
		s3_client.send(new DeleteObjectCommand({
			Bucket: process.env.GAME_FRAMES_BUCKET,
			Key: score.frame_file,
		}));

		console.log(`Deleted game ${req.params.id}'s' file ${score.frame_file}`);
	}

	res.json({ status: 'ok' });
});

module.exports = router;