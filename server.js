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


app.get('/debug', (req, res) => {
	res.send(JSON.stringify(req.session));
});

app.get('/login', (req, res) => {
	if (!req.session.twitch) {
		req.session.twitch = {};
	};

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

	req.session.twitch.token = token;

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

		const db_client = await db_pool.connect();
		const result = await client.query(
			`INSERT INTO twitch_users
			(id, login, email, secret, type, description, display_name, profile_image_url, created_on, last_login)
			VALUES
			($1, $2, $3, $4, $5, $5, $6, $7, $7, $8, NOW(), NOW());

			ON CONFLICT(id)
			DO
				UPDATE SET login=$2, email=$3, type=$5, description=$6, display_name=$7, profile_image_url=$8, last_login=NOW();
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

		// at the very end, record user in session and return response
		req.session.twitch.user = user_object;
		res.json({
			user_object,
			db_record: result.rows[0]
		});
	}
	catch(err) {
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

server.listen(PORT);

/*
https://id.twitch.tv/oauth2/authorize?
response_type=code
&redirect_uri=https%3A%2F%2Fmaxoutclub.com%2Fauth%2Ftwitch%2Fcallback
&scope=user%3Aread%3Aemail%20channel%3Aread%3Asubscriptions
&client_id=kxu1nt4xee7vz4gsebiwy8cld0lfro
/**/

