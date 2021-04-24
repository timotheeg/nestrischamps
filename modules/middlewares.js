const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const MemoryStore = require('memorystore')(session);
const dbPool = require('./db');
const pgSession = require('connect-pg-simple')(session);
const UserDAO = require('../daos/UserDAO');

module.exports = {
	sessionMiddleware: session({
		secret: process.env.SESSION_SECRET || uuidv4(),
		resave: false,
		saveUninitialized: true,
		cookie: {
			secure: !!process.env.IS_PUBLIC_SERVER
		},
		genid: uuidv4,
		store: new pgSession({
			pool:      dbPool,
			tableName: 'sessions',
		}),
		name: 'nsid'
	}),

	async assertSession(req, res, next) {
		if (!req.session || !req.session.user) {
			req.session.auth_success_redirect = req.originalUrl;
			res.redirect('/auth');
		}
		else {
			// bit of a hack, we check the user object and set the token if needed
			// we assume that the token is in thee session!
			const user = await UserDAO.getUserById(request.session.user.id);

			if (!user.hasTwitchToken()) {
				user.setTwitchToken(req.session.token);
			}
			else {
				// verify if the user token has been refreshed and if the session should be updated accordingly
				const utoken = user.token;
				const stoken = req.session.token;

				if (utoken.access_token != stoken.access_token) {
					// set the session token to be the same as user token
					req.session.token = {
						...utoken.access_token,
						expires_in: Math.max(0, Math.round((utoken.expiry.getTime() - Date.now()) / 1000));
					};
				}
			}

			next();
		}
	}
};