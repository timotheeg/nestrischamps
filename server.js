import WebSocket from 'ws';
import app from './modules/app.js';
import { Server } from 'http';

const server = Server(app);
const wss = new WebSocket.Server({
	clientTracking: false,
	noServer: true,
});

require('./routes/websocket.js')(server, wss);

server.listen(process.env.PORT || 5000);
