const middlewares = require('./middlewares');
const UserDAO = require('../daos/UserDAO');
const Connection = require('./Connection');

module.exports = function init(server, wss) {
	server.on('upgrade', async function (request, socket, head) {
		console.log('WS: ', request.originalUrl, request.url);

		const m = request.url.match(/^\/ws\/view\/(1p|mp)\/([a-z_-]+)\/([a-zA-Z0-9-]+)/);

		request.is_secret_view = !!m;

		if (request.is_secret_view) {
			if (!request.tetris) {
				request.tetris = {};
			}

			request.tetris.view = {
				single_player: m[1] == '1p',
				layout_id:     m[2],
				user_secret:   m[3],
			};

			// connection from the non-session-ed views (from OBS)
			const user = await UserDAO.getUserBySecret(request.tetris.view.user_secret);

			console.log(`WS: Retrieved user ${user.login} from view secret`);

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
					wss.emit('connection', ws, request);
				});
			});
		}
	});

	wss.on('connection', async (ws, request) => {
		const user = await UserDAO.getUserById(request.session.user.id);
		const connection = new Connection(user, ws);

		user.addConnection(connection);

		if (request.is_secret_view) {
			const room = request.tetris.view.single_player
				? user.getPrivateRoom()
				: user.getMatchRoom()
			;

			room.addView(connection);
		}
		else if(request.originalUrl === '/ws/producer') {
			user.getPrivateRoom().setProducer(connection);
		}

		ws.on('message', function (message) {
			console.log(`Received message from user ${userId}`);
			console.log(typeof message, message);
		});

		ws.on('close', function () {});
	});
};