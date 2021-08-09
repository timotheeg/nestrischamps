const path = require('path');
const express = require('express');
const middlewares = require('./middlewares');
const app = express();

app.set('view engine', 'ejs');
app.set('trust proxy', 1); // trust first proxy (i.e. heroku) -- needed to get req.protocol correctly

app.use(express.static(path.join(__dirname, '../public')));
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
			if (!req.originalUrl.startsWith('/auth')) {
				console.log('Storing auth_success_redirect', req.originalUrl);
				req.session.auth_success_redirect = req.originalUrl;
			}
		}

		TWITCH_LOGIN_QS.set(
			'redirect_uri',
			`${req.protocol}://${req.get('host')}/auth/twitch/callback`
		);

		const qs = TWITCH_LOGIN_QS.toString();

		res.locals.twitch_login_url = `${TWITCH_LOGIN_BASE_URI}${qs}`;
	}

	next();
});

app.use('/auth', require('../routes/auth'));
app.use('/stats', require('../routes/score'));
app.use('/settings', require('../routes/settings'));
app.use('', require('../routes/routes'));

module.exports = app;
