const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');
const layout_files = require('../modules/layouts');

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

router.get('/producer/:room?', middlewares.assertSession, (req, res) => {
	res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
});

// TODO: uniformalize the alyout and file names
// TODO: AND uniformalize the way the layout understnd incoming data

// TODO: construct the routes based on available layouts - That will allow express to deal with 404s itself
router.get('/view/:layout/:secret', (req, res) => {
	const layout = layout_files[req.params.layout];

	if (!layout) {
		res.status(404).send('Not found');
		return;
	}

	res.sendFile(path.join(__dirname, `../public/views/${layout.file}.html`));
});

module.exports = router;