import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import dbPool from './db.js';
import pgConnect from 'connect-pg-simple';
import UserDAO from '../daos/UserDAO.js';

const pgSession = pgConnect(session);

export default {
	sessionMiddleware: session({
		secret: process.env.SESSION_SECRET || uuidv4(),
		resave: false,
		saveUninitialized: true,
		cookie: {
			secure: !!process.env.IS_PUBLIC_SERVER,
		},
		genid: uuidv4,
		store: new pgSession({
			pool: dbPool,
			tableName: 'sessions',
		}),
		name: 'nsid',
	}),

	assertSession(req, res, next) {
		if (!req.session || !req.session.user) {
			req.session.auth_success_redirect = req.originalUrl;
			res.redirect('/auth');
		} else {
			next();
		}
	},

	async checkToken(req, res, next) {
		const user = await UserDAO.getUserById(req.session.user.id);

		if (req.session.token) {
			if (!user.hasTwitchToken()) {
				// assumes session has token!
				user.setTwitchToken(req.session.token);
			} else {
				// verify if the user token has been refreshed and if the session should be updated accordingly
				const utoken = user.token;
				const stoken = req.session.token;

				if (utoken.access_token != stoken.access_token) {
					// set the session token to be the same as user token
					req.session.token = utoken;
				}
			}
		} else if (user.hasTwitchToken()) {
			req.session.token = user.token;
		}

		if (next) next();
	},
};
