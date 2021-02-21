modules.exports = function init(server, app, wss) {
	server.on('upgrade', function (request, socket, head) {
		console.log('Parsing session from request...');

		sessionMiddleware(request, {}, () => {
			if (!request.session.user) {
				socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
				socket.destroy();
				return;
			}

			console.log('Session is parsed!');

			wss.handleUpgrade(request, socket, head, function (ws) {
				wss.emit('connection', ws, request);
			});
		});
	});

	wss.on('connection', function (ws, request) {
		const userId = request.session.user.id;

		ws.on('message', function (message) {
			console.log(`Received message from user ${userId}`);
			console.log(typeof message, message);
		});

		ws.on('close', function () {});
	});
};