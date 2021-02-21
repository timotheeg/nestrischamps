const express = require('express');
const ULID = require('ulid');
const got = require('got');

const UserDAO = require('../daos/UserDAO');

const router = express.Router();

router.get('/', (req, res) => {
	res.render('login', {
		client_id: process.env.TWITCH_CLIENT_ID,
		redirect_uri: `${req.protocol}://${req.get('host')}/auth/twitch/callback`,
		scope: 'user:read:email'
	});
});

router.get('/twitch/callback', async (req, res) => {
	console.log('received code', req.query.code);

	if (!req.query.code) {
		res.send(`Unable to authenticate [${req.query.error}]: ${req.query.error_description}`);
		return;
	}

	const token_response = await got.post('https://id.twitch.tv/oauth2/token', {
		searchParams: {
			client_id: process.env.TWITCH_CLIENT_ID,
			client_secret: process.env.TWITCH_CLIENT_SECRET,
			code: req.query.code,
			grant_type: 'authorization_code',
			redirect_uri: `${req.protocol}://${req.get('host')}/auth/twitch/callback`
		},
		responseType: 'json'
	});

	const token = token_response.body;

	console.log(token, token.access_token);

	try {
		// must validate token to get user id
		const user_response = await got.get('https://id.twitch.tv/oauth2/validate', {
			headers: {
				'Authorization': `OAuth ${token.access_token}`
			},
			responseType: 'json'
		});

		// finally can get user data from user id
		const user_data_response = await got.get('https://api.twitch.tv/helix/users', {
			headers: {
				'Client-Id': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${token.access_token}`
			},
			searchParams: {
				id: user_response.body.user_id
			},
			responseType: 'json'
		});

		const user_object = user_data_response.body.data[0];

		// augment use object with data we retrieve previously
		user_object.token = token;
		user_object.secret = ULID.ulid();

		const user = await UserDAO.createUser(user_object);

		console.log(`Retrieved user ${user.login} from Twitch authorisation`);

		req.session.user = {
			id:     user.id,
			login:  user.login,
			secret: user.secret,
		};

		console.log('Stored session user as', req.session.user);

		if (req.session.auth_success_redirect) {
			res.redirect(req.session.auth_success_redirect)
		}
		else {
			res.render('intro');
		}
	}
	catch(err) {
		console.error(err);
		res.status(500).send('meh T_T');
	}
});

module.exports = router;

