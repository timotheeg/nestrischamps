import express from 'express';
import ULID from 'ulid';
import got from 'got';

import UserDAO from '../daos/UserDAO.js';

const router = express.Router();

if (process.env.IS_PUBLIC_SERVER) {
	router.get('/', (req, res) => {
		res.render('login', {
			client_id: process.env.TWITCH_CLIENT_ID,
			redirect_uri: `${req.protocol}://${req.get('host')}/auth/twitch/callback`,
			twitch_scope: 'chat:read', // 'user:read:email'
		});
	});
} else {
	router.get('/', (req, res) => {
		res.render('local_login');
	});

	router.get('/set_session_player/:player_id', async (req, res) => {
		const user = await UserDAO.getUserById(req.params.player_id);

		console.log(
			`Retrieved local user object from DB for ${user.id} (${user.login})`
		);

		req.session.user = {
			id: user.id,
			login: user.login,
			secret: user.secret,
			profile_image_url: user.profile_image_url,
			country_code: user.country_code,
		};

		console.log('Stored session user as', req.session.user);

		if (req.session.auth_success_redirect) {
			res.redirect(req.session.auth_success_redirect);
		} else {
			res.render('intro');
		}
	});
}

router.get('/twitch/callback', async (req, res) => {
	console.log(`Twitch callback received with code [${req.query.code}]`);

	if (!req.query.code) {
		res
			.status(400)
			.send(
				`Unable to authenticate [${req.query.error}]: ${req.query.error_description}`
			);
		return;
	}

	try {
		const { body: token } = await got.post(
			'https://id.twitch.tv/oauth2/token',
			{
				searchParams: {
					client_id: process.env.TWITCH_CLIENT_ID,
					client_secret: process.env.TWITCH_CLIENT_SECRET,
					code: req.query.code,
					grant_type: 'authorization_code',
					redirect_uri: `${req.protocol}://${req.get(
						'host'
					)}/auth/twitch/callback`,
				},
				responseType: 'json',
			}
		);

		console.log(`Retrieved oauth token`);

		// must validate token to get user id
		const user_response = await got.get(
			'https://id.twitch.tv/oauth2/validate',
			{
				headers: {
					Authorization: `OAuth ${token.access_token}`,
				},
				responseType: 'json',
			}
		);

		console.log(`Completed token validation for ${user_response.body.user_id}`);

		// finally can get user data from user id
		const user_data_response = await got.get(
			'https://api.twitch.tv/helix/users',
			{
				headers: {
					'Client-Id': process.env.TWITCH_CLIENT_ID,
					'Authorization': `Bearer ${token.access_token}`,
				},
				searchParams: {
					id: user_response.body.user_id,
				},
				responseType: 'json',
			}
		);

		const user_object = user_data_response.body.data[0];

		console.log(
			`Retrieved user data for ${user_response.body.user_id} (${user_object.login})`
		);

		// augment use object with data we retrieve previously
		user_object.secret = ULID.ulid();

		const user = await UserDAO.createUser(user_object);

		console.log(
			`Retrieved user object from DB for ${user_response.body.user_id} (${user_object.login})`
		);

		user.setTwitchToken(token);

		req.session.token = token;
		req.session.user = {
			id: user.id,
			login: user.login,
			secret: user.secret,
			profile_image_url: user.profile_image_url,
		};

		console.log('Stored session user as', req.session.user);

		if (req.session.auth_success_redirect) {
			res.redirect(req.session.auth_success_redirect);
		} else {
			res.redirect('/');
		}
	} catch (err) {
		console.error(`Error when processing Twicth callback`);
		console.error(err);
		res
			.status(500)
			.send(
				`An unexpected error occured with your Twich login: ${err.message}. Please try again later`
			);
	}
});

export default router;
