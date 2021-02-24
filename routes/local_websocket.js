const layouts = require('../modules/layouts');
const UserDAO = require('../daos/UserDAO');
const Connection = require('../modules/Connection');

module.exports = function init(server, wss) {
	server.on('upgrade', async function (request, socket, head) {
		console.log('WS: ', request.url);

		if (!request.session) {
			request.session = {};
		}

		if (!request.tetris) {
			request.tetris = {};
		}

		let user;

		let m = request.url.match(/^\/ws\/view\/([a-z0-9_-]+)/);

		request.is_secret_view = !!m;

		if (request.is_secret_view) {
			request.tetris.view = {
				single_player: layouts[m[1]].type == '1p',
				layout_id:     m[1],
			};

			// connection from the non-session-ed views (from OBS)
			user = await UserDAO.getPlayer1();

			console.log(`WS: Retrieved user ${user.login} from view secret`, request.tetris.view);

		}
		else {
			if (m = request.url.match(/^\/ws\/player([12])$/)) {
				user = await UserDAO.getLocalPlayer(m[1]);
			}
			else if (/^\/ws\/(admin|play)$/.test(request.url)) {
				user = await UserDAO.getPlayer1();
			}
			else {
				socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); // TODO: can this redirect?
				socket.destroy();
				return;
			}
		}

		request.session.user = {
			id:     user.id,
			login:  user.login,
			secret: user.secret,
		};

		wss.handleUpgrade(request, socket, head, function (ws) {
			wss.emit('connection', ws, request);
		});
	});

	wss.on('connection', async (ws, request) => {
		console.log('WS: Connection!', request.session.user.id, 'secret?', request.is_secret_view);

		const player1 = await UserDAO.getPlayer1();
		const user = await UserDAO.getUserById(request.session.user.id);
		const connection = new Connection(user, ws);

		user.addConnection(connection);

		if (request.is_secret_view) {
			console.log('Adding View', user.login, 'single?', request.tetris.view.single_player);
			const room = request.tetris.view.single_player
				? player1.getPrivateRoom()
				: player1.getMatchRoom()
			;

			room.addView(connection);
		}
		else if(request.url === '/ws/play') {
			player1.getPrivateRoom().setProducer(connection);
		}
		else if(request.url.startsWith('/ws/player')) {
			player1.getMatchRoom().addProducer(connection);
		}
		else {
			console.log('Unrecognized connection');
		}
	});
};