const { Pool } = require('pg');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session)
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidV4 } = require('uuid');
const ULID = require('ulid');
const got = require('got');

const PORT = process.env.PORT || 5000;

const db_pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: {
		rejectUnauthorized: false
	}
});


function assertSession(req, res, next) {
	if (!req.session.user) {
		res.redirect('/login');
	}
	else {
		next();
	}
}

app.set('view engine', 'ejs')
app.use(express.static('public'))


app.set('trust proxy', 1) // trust first proxy
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: true,
	cookie: { secure: true },
	genid: () => ULID.ulid(),
	store: new MemoryStore({
		checkPeriod: 86400000 // prune expired entries every 24h
	})
}));


app.get('/debug/session', (req, res) => {
	res.send(JSON.stringify(req.session));
});

app.get('/login', (req, res) => {
	res.render('login', {
		client_id: process.env.TWITCH_CLIENT_ID,
		redirect_uri: `${req.protocol}://${req.get('host')}/auth/twitch/callback`,
		scope: 'user:read:email'
	});
});

app.get('/auth/twitch/callback', async (req, res) => {
	console.log('received code', req.query.code);

	const token_response = await got.post('https://id.twitch.tv/oauth2/token', {
		searchParams: {
			client_id: process.env.TWITCH_CLIENT_ID,
			client_secret: process.env.TWITCH_CLIENT_SECRET,
			code: req.query.code,
			grant_type: 'authorization_code',
			redirect_uri: `${req.protocol}://${req.get('host')}/auth/twitch/callback`
		},
		responseType: 'json'
	});

	const token = token_response.body;

	console.log(token, token.access_token);

	try {
		const user_response = await got.get('https://id.twitch.tv/oauth2/validate', {
			headers: {
				'Authorization': `OAuth ${token.access_token}`
			},
			responseType: 'json'
		});

		const user_data_response = await got.get('https://api.twitch.tv/helix/users', {
			headers: {
				'Client-Id': process.env.TWITCH_CLIENT_ID,
				'Authorization': `Bearer ${token.access_token}`
			},
			searchParams: {
				id: user_response.body.user_id
			},
			responseType: 'json'
		});

		const user_object = user_data_response.body.data[0];

		// insert/update user
		const db_client = await db_pool.connect();
		const insert_result = await db_client.query(
			`INSERT INTO twitch_users
			(id, login, email, secret, type, description, display_name, profile_image_url, created_on, last_login)
			VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
			ON CONFLICT(id)
			DO UPDATE SET login=$2, email=$3, type=$5, description=$6, display_name=$7, profile_image_url=$8, last_login=NOW();
			`,
			[
				user_object.id,
				user_object.login,
				user_object.email,
				ULID.ulid(),
				user_object.type,
				user_object.description,
				user_object.display_name,
				user_object.profile_image_url,
			]
		);

		// query again to get the user secret
		const query_secret_result = await db_client.query(
			'SELECT secret FROM twitch_users WHERE id=$1;',
			[ user_object.id, ]
		);

		console.log(query_secret_result.rows[0]);

		user_object.secret = query_secret_result.rows[0].secret;

		req.session.user = user_object; // do we need to store the access token?

		res.json({
			token,
			user_response: user_response.body,
			user_object,
		});
	}
	catch(err) {
		console.error(err);
		// TODO: Add status code 500 (or whatever)
		res.send('meh T_T');
	}
});

app.get('/:room', (req, res) => {
	res.render('room', { roomId: req.params.room })
});

io.on('connection', socket => {
	socket.on('join-room', (roomId, userId) => {
		socket.join(roomId)
		socket.to(roomId).broadcast.emit('user-connected', userId)

		socket.on('disconnect', () => {
			socket.to(roomId).broadcast.emit('user-disconnected', userId)
		})
	})
});


function dummy(res) {
	res.send('dummy ok');
}

app.get('/ocr', assertSession, (req, res) => dummy(res) );
app.get('/invite/:roomid', assertSession, (req, res) => dummy(res) );
app.get('/admin', assertSession, (req, res) => dummy(res) );

app.get('/view/:name/:secret', (req, res) => dummy(res) );

server.listen(PORT);


