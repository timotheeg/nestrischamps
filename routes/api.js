import path from 'path';
import express from 'express';
import { pick } from 'lodash';
import { celebrate, Joi, Segments } from 'celebrate';
import got from 'got';

const STACKRABBIT_URL = 'https://stackrabbit.herokuapp.com/engine';

const router = express.Router();

function parseStackRabbitRequest(query) {
	if (!query.board || !/^[01]{200}$/.test(query.board))
		throw new Error('Invalid Board');
	if (!query.currentPiece || !/^TJZOSLI$/.test(query.currentPiece))
		throw new Error('Invalid Current Piece');
	if (!query.nextPiece || !/^TJZOSLI$/.test(query.nextPiece))
		throw new Error('Invalid Next Piece');
	if (!query.level || !/^1[89]$/.test(query.level))
		throw new Error('Invalid Level');
	if (!query.lines || !/^\d{3}$/.test(query.lines))
		throw new Error('Invalid Lines');
	if (!query.reactionTime || !/^\d{2}$/.test(query.reactionTime))
		throw new Error('Invalid reactionTime');
	if (!query.inputFrameTimeline || !/^[X.]{5}$/.test(query.inputFrameTimeline))
		throw new Error('Invalid inputFrameTimeline');

	return pick(
		query[
			('board',
			'currentPiece',
			'nextPiece',
			'level',
			'lines, reactionTime',
			'inputFrameTimeline')
		]
	);
}

// proxy to stack rabbit engine API
// careis taken to make sure only valid requests are forwarded
router.get('/recommendation/:id', async (req, res) => {
	const searchParams = parseStackRabbitRequest(req.query);
	const { data } = await got(STACKRABBIT_URL, { searchParams }).json();
	res.send({
		id: req.params.id,
		recommendation: data[0],
	}); // only send top recommendation
});

export default router;
