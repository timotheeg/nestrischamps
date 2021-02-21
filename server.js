const express = require('express');
const WebSocket = require('ws');

const app = require('./modules/app');

const server = require('http').Server(app);
const wss = new WebSocket.Server({
	path: '/ws',
	clientTracking: false,
	noServer: true,
	followRedirects: true,
});

require('./modules/websocket.js')(server, wss);

server.listen(process.env.PORT || 5000);
