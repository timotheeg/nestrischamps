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

router.get('/producer/:room?', middlewares.assertSession, (req, res) => {
	res.sendFile('./public/ocr/ocr.html');
});

router.get('/player_socket', middlewares.assertSession, (req, res) => {
	res.render('player_socket');
});

router.get('/view/:name/:secret', (req, res) => dummy(res) );

module.exports = router;