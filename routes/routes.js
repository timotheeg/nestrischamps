const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');

function dummy(res) {
	res.send('dummy ok');
}

router.get('/debug/session', (req, res) => {
	res.send(JSON.stringify(req.session));
});

router.get('/ocr', middlewares.assertSession, (req, res) => dummy(res) );
router.get('/invite/:roomid', middlewares.assertSession, (req, res) => dummy(res) );
router.get('/admin', middlewares.assertSession, (req, res) => dummy(res) );
router.get('/renderers', middlewares.assertSession, (req, res) => {
	res.render('renderers', {
		secret: req.session.user.secret
	});
});

router.get('/producer/local/player[12]', (req, res) => {
	res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
});

router.get('/producer/:room?', middlewares.assertSession, (req, res) => {
	res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
});

// TODO: uniformalize the alyout and file names
// TODO: AND uniformalize the way the layout understnd incoming data
const layout_files = {
	'1p': {
		das_trainer: 'skin_das_trainer',
		simple_1p: 'simple_1p_layout',
		invisible_tetris: 'simple_1p_layout_invisible_tetris',
	},

	'mp': {
		ctwc: 'competition_layout1',
		ctjc: 'competition_layout1_ctjc',
	}
};

// TODO: construct the routes based on available layouts - That will allow express to deal with 404s itself
router.get('/view/:type([1m]p)/:layout/:secret', (req, res) => {
	const layout = layout_files[req.params.type][req.params.layout];

	if (!layout) {
		res.status(404).send('Not found');
		return;
	}

	res.sendFile(path.join(__dirname, `../public/views/${layout}.html`));
});

module.exports = router;