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

	const user_response = await got.get('https://api.twitch.tv/kraken/user', {
		headers: {
			'Accept':        'application/vnd.twitchtv.v5+json',
			'Client-ID':     process.env.TWITCH_CLIENT_ID,
			'Authorization': `OAuth ${token.access_token}`
		},
		responseType: 'json'
	});

	res.json(user_response.body);
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

