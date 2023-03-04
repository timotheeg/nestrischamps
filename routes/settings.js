import express from 'express';
import ULID from 'ulid';
import nocache from 'nocache';
import _ from 'lodash';

import middlewares from '../modules/middlewares.js';
import { countries } from '../modules/countries.js';
import UserDAO from '../daos/UserDAO.js';
import ScoreDAO from '../daos/ScoreDAO.js';
import timezones from '../modules/timezones.js';

const router = express.Router();

router.use(middlewares.assertSession);
router.use(middlewares.checkToken);
router.use(nocache());

router.get('/', async (req, res) => {
	const user = await UserDAO.getUserById(req.session.user.id);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	res.render('settings', {
		db_user: user,
		countries,
		timezones,
	});
});

router.get('/revoke_secret', async (req, res) => {
	const user = await UserDAO.getUserById(req.session.user.id);

	if (!user) {
		res.status(404).send('User Not found');
		return;
	}

	await UserDAO.updateSecret(user, ULID.ulid());

	req.session.user = {
		id: user.id,
		login: user.login,
		secret: user.secret,
		profile_image_url: user.profile_i1mage_url,
	};

	res.redirect('/settings');
});

router.get('/clear_session', async (req, res) => {
	req.session.destroy();
	res.redirect('/');
});

function getAge(dateString /*YYYY-MM-DD*/) {
	const now = new Date();
	const today_str = now.toISOString().slice(0, 10);
	const today = new Date(today_str);
	const birthDate = new Date(dateString);
	const m = today.getMonth() - birthDate.getMonth();

	let age = today.getFullYear() - birthDate.getFullYear();

	if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age;
}

router.post('/update_profile', express.json(), async (req, res) => {
	if (!req.body) {
		res.status(400).json({ errors: ['Bad Request'] });
		return;
	}

	const errors = [];
	const update = {};

	if (/^(das|tap|roll|hybrid)$/i.test(req.body.style)) {
		update.style = req.body.style.toLowerCase();
	} else {
		errors.push('Style is not valid');
	}

	const code = (req.body.country_code || '').toUpperCase();

	// crude string test first, and then date test
	if (
		/^(19|20)\d{2}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/.test(req.body.dob)
	) {
		const age = getAge(req.body.dob);

		// arbitrary age boundaries
		if (age < 10 || age > 100) {
			update.dob = null;
			// errors.push('Dob is not valid');
		} else {
			update.dob = req.body.dob;
		}
	} else {
		update.dob = null;
		// errors.push('Dob is not valid');
	}

	if (code && countries.some(country => country.code === code)) {
		update.country_code = code;
	} else {
		errors.push('Country code is not valid');
	}

	if (typeof req.body.city === 'string') {
		update.city = req.body.city;
	} else {
		errors.push('City is not valid');
	}

	if (
		typeof req.body.timezone === 'string' &&
		timezones.includes(req.body.timezone)
	) {
		update.timezone = req.body.timezone;
	} else {
		errors.push('Timezone is not valid');
	}

	if (typeof req.body.interests === 'string') {
		update.interests = req.body.interests;
	} else {
		errors.push('Interests are not valid');
	}

	if (errors.length) {
		console.log({ errors });
		res.status(400).json({ errors });
	} else {
		await UserDAO.updateProfile(req.session.user.id, update);
		res.status(200).json({});
	}
});

router.post('/set_pb', express.json(), async (req, res) => {
	if (!req.body) {
		res.status(400).json({ errors: ['Bad Request'] });
		return;
	}

	const update = _.pick(req.body, [
		'score',
		'start_level',
		'end_level',
		'competition',
	]);

	do {
		if (
			typeof update.score != 'number' ||
			update.score < 0 ||
			update.score > 1500000
		)
			break;

		if (
			typeof update.start_level != 'number' ||
			update.start_level < 0 ||
			update.start_level > 30
		)
			break;

		if (
			typeof update.end_level != 'number' ||
			update.end_level < 0 ||
			update.end_level > 30
		)
			break;

		if (typeof update.competition != 'boolean') break;

		const user = await UserDAO.getUserById(req.session.user.id);

		// fire and forget
		await ScoreDAO.setPB(user, update);
		res.status(200).json({});
		return;
	} while (false); // eslint-disable-line no-constant-condition

	res.status(400).json({ errors: ['Bad Request'] });
});

export default router;
