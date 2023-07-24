import { WebSocketServer } from 'ws';
import fs from 'fs';
import http from 'http';
import https from 'https';

import app from './modules/app.js';

import { addUpgradeHandler, addConnectionHandler } from './routes/websocket.js';

const wss = new WebSocketServer({
	clientTracking: false,
	noServer: true,
});
addConnectionHandler(wss);

const sslServer = https.createServer(
	{
		key: fs.readFileSync('key.pem'),
		cert: fs.readFileSync('cert.pem'),
	},
	app.handle.bind(app)
);

addUpgradeHandler(sslServer, wss);
sslServer.listen(process.env.SSL_PORT || 5443);

/*
const server = http.createServer(app);
addUpgradeHandler(server, wss);
server.listen(process.env.PORT || 5080);
/**/

console.log([process.env.PORT || 5080, process.env.SSL_PORT || 5443]);
