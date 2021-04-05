const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');
const UserDAO = require('../daos/UserDAO');
const ScoreDAO = require('../daos/ScoreDAO');

const layout_files = require('../modules/layouts');


function dummy(res) {
	res.send('dummy ok');
}

router.get('/room/admin', (req, res) => {
	res.sendFile(path.join(__dirname, '../public/views/competition_admin.html'));
});

// match access
router.get('/player[12]', (req, res) => {
	res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
});

// single player play
router.get('/play', (req, res) => {
	res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
});

router.get('/view/:layout', (req, res) => {
	const layout = layout_files[req.params.layout];

	if (!layout) {
		res.status(404).send('Not found');
		return;
	}

	res.sendFile(path.join(__dirname, `../public/views/${layout.file}.html`));
});

async function getScores(req, res) {
	const user = await UserDAO.getPlayer1();

	res.json(await ScoreDAO.getStats(user));
}

router.get('/stats/get_stats', getScores);
router.get('/stats/report_game', getScores);

module.exports = router;