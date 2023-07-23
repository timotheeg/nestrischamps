import { WebSocketServer } from 'ws';
import { Server } from 'http';
import fs from 'fs';
import https from 'https';

import app from './modules/app.js';

// const server = Server(app);

const server = https.createServer(
	{
		key: fs.readFileSync('key.pem'),
		cert: fs.readFileSync('cert.pem'),
	},
	app
);

const wss = new WebSocketServer({
	clientTracking: false,
	noServer: true,
});

import websocketInitializer from './routes/websocket.js';

websocketInitializer(server, wss);

server.listen(process.env.PORT || 5000);
