import express from 'express';
import ULID from 'ulid';
import got from 'got';

import { OAuth2Client as GoogleOAuth2Client } from 'google-auth-library';

const googleOAuth2Client = new GoogleOAuth2Client(
	process.env.GOOGLE_AUTH_CLIENT_ID,
	process.env.GOOGLE_AUTH_CLIENT_SECRET,
	process.env.GOOGLE_AUTH_REDIRECT_URL
);

const TWITCH_LOGIN_BASE_URI = 'https://id.twitch.tv/oauth2/authorize?';
const TWITCH_LOGIN_QS = new URLSearchParams({
	client_id: process.env.TWITCH_CLIENT_ID,
	scope: 'user:read:email chat:read',
	response_type: 'code',
	force_verify: true,
});

import UserDAO from '../daos/UserDAO.js';

const router = express.Router();

if (process.env.IS_PUBLIC_SERVER) {
	router.get('/', (req, res) => {
		res.render('login');
	});

	router.get('/twitch', (req, res) => {
		TWITCH_LOGIN_QS.set(
			'redirect_uri',
			`${process.env.IS_PUBLIC_SERVER ? 'https' : req.protocol}://${req.get(
				'host'
			)}/auth/twitch/callback`
		);

		const qs = TWITCH_LOGIN_QS.toString();
		const url = `${TWITCH_LOGIN_BASE_URI}${qs}`;

		res.redirect(url);
	});

	router.get('/google', (req, res) => {
		const url = googleOAuth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: ['profile', 'email'],
		});
		res.redirect(url);
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

		req.session.save(() => {
			console.log('Stored session user as', req.session.user);

			if (req.session.auth_success_redirect) {
				res.redirect(req.session.auth_success_redirect);
			} else {
				res.render('intro');
			}
		});
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

		console.log({ data: user_data_response.body.data });

		const user_object = user_data_response.body.data[0];

		console.log(
			`Retrieved user data for ${user_response.body.user_id} (${user_object.login})`
		);

		// augment use object with data we retrieve previously
		user_object.secret = ULID.ulid();

		// NEED more logic here to check BOTh the users and oauth users table sigh...
		const user = await UserDAO.createUser(user_object, {
			provider: 'twitch',
			current_user: req.session.user,
			pending_linkage: req.session.pending_linkage,
		});

		console.log(
			`Retrieved user object from DB for ${user_response.body.user_id} (${user_object.login})`
		);

		user.setTwitchToken(token);

		// TODO: modify when adding google auth
		req.session.token = {
			twitch: token,
		};

		req.session.user = {
			id: user.id,
			login: user.login,
			secret: user.secret,
			profile_image_url: user.profile_image_url,
		};

		req.session.save(() => {
			console.log('Stored session user as', req.session.user);

			if (req.session.auth_success_redirect) {
				res.redirect(req.session.auth_success_redirect);
			} else {
				res.redirect('/');
			}
		});
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

router.get('/google/callback', async (req, res) => {
	const code = req.query.code;
	if (code) {
		try {
			const { tokens } = await googleOAuth2Client.getToken(code);
			googleOAuth2Client.setCredentials(tokens);

			// Save the token to the session
			req.session.token = { google: tokens };

			// Get user info from Google
			const ticket = await googleOAuth2Client.verifyIdToken({
				idToken: tokens.id_token,
				audience: process.env.GOOGLE_AUTH_CLIENT_ID,
			});
			const payload = ticket.getPayload();

			console.log(payload);

			// Save user info to the session
			req.session.user = {
				id: payload.sub,
				email: payload.email,
				name: payload.name,
				picture: payload.picture,
			};

			res.redirect('/auth/profile');
		} catch (error) {
			console.error('Error during authentication:', error);
			res.redirect('/');
		}
	} else {
		res.redirect('/');
	}
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
	if (req.session.token) {
		return next();
	}
	res.redirect('/');
};

router.get('/profile', isAuthenticated, (req, res) => {
	res.send(`
	  <h1>Profile</h1>
	  <p>Name: ${req.session.user.name}</p>
	  <p>Email: ${req.session.user.email}</p>
	  <img src="${req.session.user.picture}" alt="Profile Picture">
	  <br><br>
	  <a href="/logout">Logout</a>
	`);
});

export default router;
