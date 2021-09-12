const path = require('path');
const express = require('express');
const router = express.Router();

const middlewares = require('../modules/middlewares');
const layouts = require('../modules/layouts');
const UserDAO = require('../daos/UserDAO');
const ScoreDAO = require('../daos/ScoreDAO');

router.get('/debug/session', (req, res) => {
	res.send(JSON.stringify(req.session));
});

router.get('/', (req, res) => {
	res.render('intro');
});

router.get(
	'/room/admin',
	middlewares.assertSession,
	middlewares.checkToken,
	(req, res) => {
		res.sendFile(
			path.join(__dirname, '../public/views/competition_admin.html')
		);
	}
);

router.get(
	'/room/u/:login/admin',
	middlewares.assertSession,
	middlewares.checkToken,
	async (req, res) => {
		const target_user = await UserDAO.getUserByLogin(req.params.login);

		if (!target_user) {
			res.status(404).send('Target User Not found');
			return;
		}

		res.sendFile(
			path.join(__dirname, '../public/views/competition_admin.html')
		);
	}
);

router.get(
	'/room/producer',
	middlewares.assertSession,
	middlewares.checkToken,
	(req, res) => {
		res.sendFile(path.join(__dirname, '../public/ocr/ocr.html'));
	}
);

router.get(
	'/room/u/:login/producer',
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
router.get(
	'/room/u/:login/view/:layout',
	middlewares.assertSession,
	middlewares.checkToken,
	async (req, res) => {
		const target_user = await UserDAO.getUserByLogin(req.params.login);

		if (!target_user) {
			res.status(404).send('Target User Not found');
			return;
		}

		const layout = layouts[req.params.layout];

		if (!layout) {
			res.status(404).send('Layout Not found');
			return;
		}

		res.sendFile(
			path.join(__dirname, `../public/views/${layout.type}/${layout.file}.html`)
		);
	}
);

router.get(
	'/renderers',
	middlewares.assertSession,
	middlewares.checkToken,
	(req, res) => {
		res.render('renderers', {
			secret: req.session.user.secret,
			layouts,
		});
	}
);

function getAge(dob) {
	const now = new Date();
	const today_str = now.toISOString().slice(0, 10);
	const today = new Date(today_str);
	const m = today.getMonth() - dob.getMonth();

	let age = today.getFullYear() - dob.getFullYear();

	if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
		age--;
	}

	return age;
}

router.get('/view/profile_card/:login', async (req, res) => {
	const user = await UserDAO.getUserByLogin(req.params.login);

	if (!user) {
		res.status(404).send('Not found');
		return;
	}

	res.render('profile_card', {
		user,
		age: user.dob ? getAge(user.dob) : 9,
		pb: await ScoreDAO.getPB(user),
	});
});

// TODO: uniformalize the alyout and file names
// TODO: AND uniformalize the way the layout understnd incoming data

// TODO: construct the routes based on available layouts - That will allow express to deal with 404s itself
router.get('/view/:layout/:secret', (req, res) => {
	const layout = layouts[req.params.layout];

	if (!layout) {
		res.status(404).send('Not found');
		return;
	}

	res.sendFile(
		path.join(__dirname, `../public/views/${layout.type}/${layout.file}.html`)
	);
});

router.get('/replay/:layout/:gamedef', (req, res) => {
	const layout = layouts[req.params.layout];

	if (!layout) {
		res.status(404).send('Not found');
		return;
	}

	res.sendFile(
		path.join(__dirname, `../public/views/${layout.type}/${layout.file}.html`)
	);
});

module.exports = router;
