import express from 'express';
import middlewares from './middlewares.js';

// crude way to prevent crashes
// not recommended since application is now in an undefined state
// still, with daily restarts, any unknown state is guaranteed to clear soon
process.on('uncaughtException', (error, origin) => {
	console.error('uncaughtException');
	console.error(error);
	console.error(origin);
});

const app = express();

app.set('view engine', 'ejs');
app.set('trust proxy', 1); // trust first proxy (i.e. heroku) -- needed to get req.protocol correctly

app.use(express.static('public'));
app.use(middlewares.sessionMiddleware);

const TWITCH_LOGIN_BASE_URI = 'https://id.twitch.tv/oauth2/authorize?';
const TWITCH_LOGIN_QS = new URLSearchParams({
	client_id: process.env.TWITCH_CLIENT_ID,
	scope: 'chat:read',
	response_type: 'code',
	force_verify: true,
});

// set up some reusable template data
app.use((req, res, next) => {
	res.locals.user = req.session.user;

	if (!req.session.user) {
		// Since there's no session use
		// We prep for when user might login

		if (req.originalUrl) {
			if (!/^\/(auth|favicon|android|apple|site)/.test(req.originalUrl)) {
				console.log('Storing auth_success_redirect', req.originalUrl);
				req.session.auth_success_redirect = req.originalUrl;
			}
		}

		TWITCH_LOGIN_QS.set(
			'redirect_uri',
			`${process.env.IS_PUBLIC_SERVER ? 'https' : req.protocol}://${req.get(
				'host'
			)}/auth/twitch/callback`
		);

		const qs = TWITCH_LOGIN_QS.toString();

		res.locals.twitch_login_url = `${TWITCH_LOGIN_BASE_URI}${qs}`;
	}

	next();
});

import authRoutes from '../routes/auth.js';
import apiRoutes from '../routes/api.js';
import scoreRoutes from '../routes/score.js';
import settingsRoute from '../routes/settings.js';
import defaultRoutes from '../routes/routes.js';

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/stats', scoreRoutes);
app.use('/settings', settingsRoute);
app.use('', defaultRoutes);

export default app;
