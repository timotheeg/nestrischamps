import express from 'express';
import middlewares from './middlewares.js';
import cors from 'cors';

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

app.use(cors());
app.use(express.static('public'));
app.use(middlewares.sessionMiddleware);

// set up some reusable template data
app.use((req, res, next) => {
	res.locals.user = req.session.user;

	if (!req.session.user) {
		// Since there's no session in use
		// We prep for when user might login

		if (req.originalUrl) {
			if (!/^\/(auth|favicon|android|apple|site)/.test(req.originalUrl)) {
				console.log('Storing auth_success_redirect', req.originalUrl);
				req.session.auth_success_redirect = req.originalUrl;
			}
		}
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
