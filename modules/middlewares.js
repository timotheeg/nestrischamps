const session = require('express-session');
const ULID = require('ulid');
const MemoryStore = require('memorystore')(session);

module.exports = {
	sessionMiddleware: session({
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: true,
		cookie: { secure: true },
		genid: ULID.ulid,
		store: new MemoryStore({
			checkPeriod: 86400000 // prune expired entries every 24h
		})
	}),

	assertSession(req, res, next) {
		if (!req.session.user) {
			req.session.auth_success_redirect = req.url;
			res.redirect('/auth');
		}
		else {
			next();
		}
	}
};