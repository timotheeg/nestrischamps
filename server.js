import { WebSocketServer } from 'ws';
import fs from 'fs';
import http from 'http';
import https from 'https';

import app from './modules/app.js';

import websocketInitializer from './routes/websocket.js';

const wss = new WebSocketServer({
	clientTracking: false,
	noServer: true,
});

const server = http.createServer(app);

const sslServer = https.createServer(
	{
		key: fs.readFileSync('key.pem'),
		cert: fs.readFileSync('cert.pem'),
	},
	app.handle.bind(app)
);

websocketInitializer(server, wss);
websocketInitializer(sslServer, wss);

server.listen(process.env.PORT || 5080);
sslServer.listen(process.env.SSL_PORT || 5443);

console.log([process.env.PORT || 5080, process.env.SSL_PORT || 5443]);
