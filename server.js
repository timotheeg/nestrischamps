const express = require('express');
const WebSocket = require('ws');

const app = require('./modules/app');

const server = require('http').Server(app);
const wss = new WebSocket.Server({
	clientTracking: false,
	noServer: true
});

require('./routes/websocket.js')(server, wss);

// setting up peerjs
const { ExpressPeerServer } = require('peerjs-server');
const peerServer = ExpressPeerServer(server, {
  path: '/'
});

app.use('/peerjs', peerServer);


server.listen(process.env.PORT || 5000);
