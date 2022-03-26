import zlib from 'zlib';
import fs from 'fs';
import _ from 'lodash';
import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import got from 'got';
import ScoreDAO from '../daos/ScoreDAO.js';

const STACKRABBIT_URL = 'https://stackrabbit.herokuapp.com/engine';

const router = express.Router();

function parseStackRabbitRequest(query) {
	if (!query.board || !/^[01]{200}$/.test(query.board))
		throw new Error(`Invalid Board: ${query.board}`);
	if (!query.currentPiece || !/^[TJZOSLI]$/.test(query.currentPiece))
		throw new Error('Invalid Current Piece');
	if (!query.nextPiece || !/^[TJZOSLI]$/.test(query.nextPiece))
		throw new Error('Invalid Next Piece');
	if (!query.level || !/^1[89]$/.test(query.level))
		throw new Error('Invalid Level');
	if (!query.lines || !/^\d{1,3}$/.test(query.lines))
		throw new Error('Invalid Lines');
	if (!query.reactionTime || !/^\d{2}$/.test(query.reactionTime))
		throw new Error('Invalid reactionTime');
	if (!query.inputFrameTimeline || !/^[X.]{5}$/.test(query.inputFrameTimeline))
		throw new Error('Invalid inputFrameTimeline');

	return _.pick(query, [
		'board',
		'currentPiece',
		'nextPiece',
		'level',
		'lines, reactionTime',
		'inputFrameTimeline',
	]);
}

// proxy to stack rabbit engine API
// careis taken to make sure only valid requests are forwarded
router.get('/recommendation', async (req, res) => {
	let searchParams;
	try {
		searchParams = parseStackRabbitRequest(req.query);
	} catch (err) {
		console.error(err);
		res.status(400).json({ error: err.message });
		return;
	}

	let data;
	try {
		data = await got(STACKRABBIT_URL, { searchParams }).json();
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
		return;
	}

	res.send(data[0]); // only send top recommendation!
});

router.get('/files/games/:id/:bucket/:filename', async (req, res) => {
	if (
		!/^[1-9]\d+$/.test(req.params.id) ||
		!/^[0-9A-Z]+$/.test(req.params.bucket) ||
		!/^[0-9A-Z]+.ngf$/.test(req.params.filename)
	) {
		res.status(400).json({ error: 'Invalid Request' });
	}

	fs.createReadStream(file_path).pipe(zlib.createGunzip()).pipe(res);
});

router.get('/games/:id', async (req, res) => {
	if (!/^[1-9]\d+$/.test(req.params.id)) {
		res.status(400).json({ error: 'Invalid Game id' });
	}

	const game = await ScoreDAO.getAnonymousScore(req.params.id);

	if (!game) {
		res.status(404).json({ error: `Game id ${req.params.id} not found` });
	}

	if (process.env.GAME_FRAMES_BUCKET) {
		const base_url = `https://${process.env.GAME_FRAMES_BUCKET}.s3-${process.env.GAME_FRAMES_REGION}.amazonaws.com/`;

		game.frame_url = `${base_url}${game.frame_file}`;
	} else {
		game.frame_url = `http://${req.headers.host}/files/${game.frame_file}`;
	}

	res.json(game);
});

export default router;
