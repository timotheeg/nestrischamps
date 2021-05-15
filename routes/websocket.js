const middlewares = require('../modules/middlewares');
const layouts = require('../modules/layouts');
const UserDAO = require('../daos/UserDAO');
const Replay = require('../domains/Replay');
const Connection = require('../modules/Connection');

module.exports = function init(server, wss) {
	server.on('upgrade', async function (request, socket, head) {
		console.log(`WS: ${request.url}`);

		let m = request.url.match(/^\/ws\/replay\/([a-z0-9_-]+)\/(\d+)(-(\d+))?/);

		if (m) {
			request.is_replay = true; // indicate no need to have user session
			request.game1_id = m[2];
			request.game2_id = m[4]; // may be null

			request.speed = 1;

			m = request.url.match(/speed=(\d+)/);

			if (m) {
				request.speed = parseInt(m[1], 10) || 1;
			}

			middlewares.sessionMiddleware(request, {}, async () => {
				wss.handleUpgrade(request, socket, head, function (ws) {
					wss.emit('connection', ws, request);
				});
			});

			return;
		}

		m = request.url.match(/^\/ws\/view\/([a-z0-9_-]+)\/([a-zA-Z0-9-]+)/);

		request.is_secret_view = !!m;

		if (request.is_secret_view) {
			if (!request.tetris) {
				request.tetris = {};
			}

			const layout = layouts[m[1]];

			if (!layout) {
				// Why does the websocket cares about the layout?
				// Answer: because it needs to know if the attachment target is private room or match room
				// When connecting over room ids (in the future), that will not matter
				// The room itself will know what type it is
				socket.write('HTTP/1.1 404 Layout not found\r\n\r\n'); // TODO: can this redirect?
				socket.destroy();
				return;
			}

			request.tetris.view = {
				single_player: layout.type == '1p',
				layout_id:     m[1],
				user_secret:   m[2],
			};

			// connection from the non-session-ed views (from OBS)
			const user = await UserDAO.getUserBySecret(request.tetris.view.user_secret);

			if (!user) {
				socket.write('HTTP/1.1 404 User Not Found\r\n\r\n'); // TODO: can this redirect?
				socket.destroy();
				return;
			}

			console.log(`WS: Retrieved user ${user.login} from view secret`, request.tetris.view);

			if (!request.session) {
				request.session = {};
			}

			request.session.user = {
				id:     user.id,
				login:  user.login,
				secret: user.secret,
			};

			wss.handleUpgrade(request, socket, head, function (ws) {
				wss.emit('connection', ws, request);
			});
		}
		else {
			// all other connections must be within a session!
			// i.e. producers and admin connections

			middlewares.sessionMiddleware(request, {}, async () => {
				if (!request.session || !request.session.user) {
					console.log(`WS: User session not found`);
					socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
					socket.destroy();
					return;
				}

				let m;

				if (m = request.url.match(/^\/ws\/room\/u\/([a-z0-9_-]+)\//)) {
					const target_user = await UserDAO.getUserByLogin(m[1]);

					if (!target_user) {
						console.log(`WS: Target User Not Found`);
						socket.write('HTTP/1.1 404 Target User Not Found\r\n\r\n');
						socket.destroy();
						return;
					}
				}

				console.log(`WS: Retrieved user ${request.session.user.login} from session`);

				wss.handleUpgrade(request, socket, head, function (ws) {
					console.log('WS: handleUpgrade complete');
					wss.emit('connection', ws, request);
				});
			});
		}
	});

	wss.on('connection', async (ws, request) => {
		if (request.is_replay) {
			const user = (request.session && request.session.user) || { id: 1 };
			const connection = new Connection(user, ws);

			if (request.game1_id) {
				new Replay(connection, 0, parseInt(request.game1_id, 10), request.speed);
			}

			if (request.game2_id) {
				new Replay(connection, 1, parseInt(request.game2_id, 10), request.speed);
			}

			return;
		}

		console.log('WS: Connection!', request.url, request.session.user.id, request.session.user.login);

		const user = await UserDAO.getUserById(request.session.user.id);

		// synchronize session token if needed
		await middlewares.checkToken(request, {});

		const connection = new Connection(user, ws);

		const pathname = url.parse(request.url).pathname;

		let m; // for url matching (if needed below)

		user.addConnection(connection);

		if (request.is_secret_view) {
			console.log('WS: Adding View', user.login, 'single?', request.tetris.view.single_player);
			const room = request.tetris.view.single_player
				? user.getPrivateRoom()
				: user.getMatchRoom()
			;

			room.addView(connection);
		}
		else if(pathname.startsWith('/ws/room/admin')) {
			console.log(`MatchRoom: ${user.login}: Admin connected`);
			user.getMatchRoom().setAdmin(connection);
		}
		else if(pathname.startsWith('/ws/room/producer')) {
			console.log(`PrivateRoom: ${user.login}: Producer connected`);
			user.getPrivateRoom().setProducer(connection);
		}
		else if(m = pathname.match(/^\/ws\/room\/u\/([a-z0-9_-]+)\//)) {
			const target_user = await UserDAO.getUserByLogin(m[1]);

			console.log(`Retrieved target user (from ${m[1]}) ${target_user.id} ${target_user.login}`);

			if (!target_user) {
				// TODO: do at Page or Upgrade level, not at websocket level
				// Although websocket is closest to resolution
				// Page level *could* cause race conditions...
				// Both Page level and Upgrade level could check for target User and throw 404s
				connection.kick('invalid_target');
			}
			else {
				const connection_type = pathname.split('/')[5];

				console.log(`Switching on ${connection_type}`);

				switch(connection_type) {
					case 'admin': {
						console.log(`MatchRoom: ${target_user.login}: Admin connected`);
						target_user.getMatchRoom().setAdmin(connection);
						break;
					}
					case 'producer': {
						console.log(`MatchRoom: ${target_user.login}: Producer ${user.login} connected`);
						target_user.getMatchRoom().addProducer(connection);
						break;
					}
					case 'view': {
						console.log(`MatchRoom: ${target_user.login}: View connected, owned by ${user.login}`);
						target_user.getMatchRoom().addView(connection);
						break;
					}
					default: {
						console.log(`WS: Invalid URL`);
						connection.kick('invalid_url');
					}
				}
			}
		}
		else {
			console.log('Unrecognized connection');
			connection.kick('invalid_url');
		}
	});
};