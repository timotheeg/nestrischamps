const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');
const layout_files = require('../modules/layouts');
const UserDAO = require('../daos/UserDAO');

function dummy(res) {
	res.send('dummy ok');
}

router.get('/debug/session', (req, res) => {
	res.send(JSON.stringify(req.session));
});

router.get('/', (req, res) => {
	res.render('intro');
});

router.get('/room/admin',
	middlewares.assertSession,
	middlewares.checkToken,
	(req, res) => {
		res.sendFile(path.join(__dirname, '../public/views/competition_admin.html'));
	}
);

router.get('/room/u/:login/admin',
	middlewares.assertSession,
	middlewares.checkToken,
	async (req, res) => {
		const target_user = await UserDAO.getUserByLogin(req.params.login);

		if (!target_user) {
			res.status(404).send('Target User Not found');
			return;
		}

		res.sendFile(path.join(__dirname, '../public/views/competition_admin.html'));
	}
);

router.get('/room/producer',
	middlewares.assertSession,
	middlewares.checkToken,
	(req, res) => {
		res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
	}
);

router.get('/room/u/:login/producer',
	middlewares.assertSession,
	middlewares.checkToken,
	async (req, res) => {
		const target_user = await UserDAO.getUserByLogin(req.params.login);

		if (!target_user) {
			res.status(404).send('Target User Not found');
			return;
		}

		res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
	}
);

// This route should only be allowed by admin for non-owner
router.get('/room/u/:login/view/:layout',
	middlewares.assertSession,
	middlewares.checkToken,
	async (req, res) => {
		const target_user = await UserDAO.getUserByLogin(req.params.login);

		if (!target_user) {
			res.status(404).send('Target User Not found');
			return;
		}

		const layout = layout_files[req.params.layout];

		if (!layout) {
			res.status(404).send('Layout Not found');
			return;
		}

		res.sendFile(path.join(__dirname, `../public/views/${layout.file}.html`));
	}
);

router.get('/renderers',
	middlewares.assertSession,
	middlewares.checkToken,
	(req, res) => {
	res.render('renderers', {
			secret: req.session.user.secret
		});
	}
);


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

router.get('/replay/:layout/:gamedef', (req, res) => {
	const layout = layout_files[req.params.layout];

	if (!layout) {
		res.status(404).send('Not found');
		return;
	}

	res.sendFile(path.join(__dirname, `../public/views/${layout.file}.html`));
});


module.exports = router;