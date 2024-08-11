import express from 'express';
import ULID from 'ulid';
import got from 'got';

import middlewares from '../modules/middlewares.js';

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

function getTwitchAuthUrl(req) {
	TWITCH_LOGIN_QS.set(
		'redirect_uri',
		`${process.env.IS_PUBLIC_SERVER ? 'https' : req.protocol}://${req.get(
			'host'
		)}/auth/twitch/callback`
	);

	const qs = TWITCH_LOGIN_QS.toString();

	return `${TWITCH_LOGIN_BASE_URI}${qs}`;
}

function getGoogleAuthUrl() {
	return googleOAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: ['profile', 'email'],
	});
}

if (process.env.IS_PUBLIC_SERVER) {
	router.get('/', (_req, res) => {
		res.render('login');
	});

	router.get('/twitch', (req, res) => {
		res.redirect(getTwitchAuthUrl(req));
	});

	router.get('/google', (req, res) => {
		res.redirect(getGoogleAuthUrl(req));
	});
} else {
	router.get('/', (_req, res) => {
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
			current_user: req.session?.user,
			pending_linkage: req.session?.pending_linkage_expiry > Date.now(),
		});

		// pending linkage is single use
		if (req.session?.pending_linkage_expiry) {
			req.session.pending_linkage_expiry = null;
			delete req.session.pending_linkage_expiry;
		}

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
			res.redirect(req.session.auth_success_redirect || '/');
		});
	} catch (err) {
		console.error(`Error when processing Twitch callback`);
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

			// Get user info from Google
			const ticket = await googleOAuth2Client.verifyIdToken({
				idToken: tokens.id_token,
				audience: process.env.GOOGLE_AUTH_CLIENT_ID,
			});
			const payload = ticket.getPayload();

			// mimic twitch shape
			const login = ULID.ulid().toLowerCase();
			const user_object = {
				id: payload.sub,
				secret: ULID.ulid(),
				type: '',
				description: '',
				login,
				display_name: login.slice(-10).toUpperCase(),
				email: payload.email,
				profile_image_url: payload.picture,
			};

			// NEED more logic here to check BOTh the users and oauth users table sigh...
			const user = await UserDAO.createUser(user_object, {
				provider: 'google',
				current_user: req.session?.user,
				pending_linkage: req.session?.pending_linkage_expiry > Date.now(),
			});

			// pending linkage is single use
			if (req.session?.pending_linkage_expiry) {
				req.session.pending_linkage_expiry = null;
				delete req.session.pending_linkage_expiry;
			}

			user.setGoogleToken(tokens);

			// Save the token to the session
			req.session.token = {
				google: tokens,
			};

			req.session.user = {
				id: user.id,
				login: user.login,
				secret: user.secret,
				profile_image_url: user.profile_image_url,
			};

			req.session.save(() => {
				console.log('Stored session user as', req.session.user);
				res.redirect(req.session.auth_success_redirect || '/');
			});
		} catch (error) {
			console.error('Error during authentication:', error);
			res.redirect('/');
		}
	} else {
		res.redirect('/');
	}
});

router.get('/link/twitch', middlewares.assertSession, async (req, res) => {
	req.session.auth_success_redirect = '/auth/link';
	req.session.pending_linkage_expiry = Date.now() + 120000; // 2 minute max to complete linkage
	res.redirect(getTwitchAuthUrl(req));
});

router.get('/link/google', middlewares.assertSession, async (req, res) => {
	req.session.auth_success_redirect = '/auth/link';
	req.session.pending_linkage_expiry = Date.now() + 120000; // 2 minute max to complete linkage
	res.redirect(getGoogleAuthUrl(req));
});

router.get('/link', middlewares.assertSession, async (req, res) => {
	const identities = await UserDAO.getIdentities(req.session.user.id);
	const providers = identities.reduce((acc, identity) => {
		acc[identity.provider] |= 0;
		acc[identity.provider] += 1;
		return acc;
	}, {});
	res.render('link', {
		providers,
		identities,
	});
});

router.get(
	'/unlink/:identity_id',
	middlewares.assertSession,
	async (req, res) => {
		// sanity check before deleting
		const identities = await UserDAO.getIdentities(req.session.user.id);
		const identity = identities.find(
			identity => (identity.id = req.params.identity_id)
		);

		// we obnly accept to remove an identity if it's not the last one
		if (identity && identities.length > 1) {
			const res = await UserDAO.removeIdentity(
				req.session.user.id,
				identity.id
			);

			const new_token = { ...req.session.token };

			delete new_token[res.provider]; // we clear the identity tokens from the session

			req.session.token = new_token;
		}

		res.redirect('/auth/link');
	}
);

export default router;
