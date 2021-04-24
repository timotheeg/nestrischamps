const session = require('express-session');
const ULID = require('ulid');
const MemoryStore = require('memorystore')(session);
const dbPool = require('./db');
const pgSession = require('connect-pg-simple')(session);

module.exports = {
	sessionMiddleware: session({
		secret: process.env.SESSION_SECRET || ULID.ulid(),
		resave: false,
		saveUninitialized: true,
		cookie: {
			secure: !!process.env.IS_PUBLIC_SERVER
		},
		genid: ULID.ulid,
		store: new pgSession({
			pool:      dbPool,
			tableName: 'sessions',
		}),
		name: 'nsid'
	}),

	assertSession(req, res, next) {
		if (!req.session.user) {
			req.session.auth_success_redirect = req.originalUrl;
			res.redirect('/auth');
		}
		else {
			next();
		}
	}
};