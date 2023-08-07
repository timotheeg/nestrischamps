import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';

import app from './modules/app.js';


const options = {
	key: readFileSync('key.pem'),
	cert: readFileSync('cert.pem')
  };

const server = createServer(options, app);

const wss = new WebSocketServer({
	clientTracking: false,
	noServer: true,
});

import websocketInitializer from './routes/websocket.js';

websocketInitializer(server, wss);

server.listen(process.env.PORT || 5000);
