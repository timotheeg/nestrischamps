const path = require('path');
const express = require('express');
const router = express.Router();
const ULID = require('ulid');

const middlewares = require('../modules/middlewares');
const UserDAO = require('../daos/UserDAO');

router.use(middlewares.assertSession);

router.get('/', async (req, res) => {
	const user = await UserDAO.getUserById(req.session.user.id);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.render('settings', {
		user
	});
});

router.get('/revoke_secret', async (req, res) => {
	const user = await UserDAO.getUserById(req.session.user.id);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	await UserDAO.updateSecret(user, ULID.ulid());

	req.session.user = {
		id:     user.id,
		login:  user.login,
		secret: user.secret,
	};

	res.redirect('/settings');
});

router.get('/clear_session', async (req, res) => {
	req.session.destroy();
	res.redirect('/settings');
});

module.exports = router;