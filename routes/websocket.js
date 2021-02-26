const middlewares = require('../modules/middlewares');
const layouts = require('../modules/layouts');
const UserDAO = require('../daos/UserDAO');
const Connection = require('../modules/Connection');

module.exports = function init(server, wss) {
	server.on('upgrade', async function (request, socket, head) {
		console.log('WS: ', request.url);

		const m = request.url.match(/^\/ws\/view\/([a-z0-9_-]+)\/([a-zA-Z0-9-]+)/);

		request.is_secret_view = !!m;

		if (request.is_secret_view) {
			if (!request.tetris) {
				request.tetris = {};
			}

			request.tetris.view = {
				single_player: layouts[m[1]].type == '1p',
				layout_id:     m[1],
				user_secret:   m[2],
			};

			// connection from the non-session-ed views (from OBS)
			const user = await UserDAO.getUserBySecret(request.tetris.view.user_secret);

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

			middlewares.sessionMiddleware(request, {}, () => {
				if (!request.session.user) {
					socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); // TODO: can this redirect?
					socket.destroy();
					return;
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
		console.log('WS: Connection!', request.session.user.id, 'secret?', request.is_secret_view);

		const user = await UserDAO.getUserById(request.session.user.id);
		const connection = new Connection(user, ws);

		user.addConnection(connection);

		if (request.is_secret_view) {
			console.log('Adding View', user.login, 'single?', request.tetris.view.single_player);
			const room = request.tetris.view.single_player
				? user.getPrivateRoom()
				: user.getMatchRoom()
			;

			room.addView(connection);
		}
		else if(request.url === '/ws/producer') {
			console.log('Setting producer to private room');
			user.getPrivateRoom().setProducer(connection);
		}
		else {
			console.log('Unrecognized connection');
		}
	});
};