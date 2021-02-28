const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');
const ScoreDAO = require('../daos/ScoreDAO');

router.get('/stats/get_stats/:secret', async (req, res) => {
	const user = await UserDAO.getUserByLogin(secret);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.json(await ScoreDAO.getStats(user));
});

router.get('/stats/u/:login/get_stats', middlewares.assertSession, async (req, res) => {
	const user = await UserDAO.getUserByLogin(req.params.login);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.json(await ScoreDAO.getStats(user));
});

router.get('/stats/get_stats', middlewares.assertSession, async (req, res) => {
	const user = await UserDAO.getUserById(req.session.id);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.json(await ScoreDAO.getStats(user));
});


router.post('/stats/report_game/:secret', middlewares.assertSession, async (req, res) => {
	const target_user = await UserDAO.getUserBySecret(req.params.secret);

	if (!target_user) {
		res.status(404).send('User Not found');
		return;
	}

	await ScoreDAO.reportGame(user, req.body);

	res.json(await ScoreDAO.getStats(user));
});

module.exports = router;