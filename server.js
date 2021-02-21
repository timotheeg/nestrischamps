const express = require('express');
const { v4: uuidV4 } = require('uuid');
const ULID = require('ulid');
const WebSocket = require('ws');

const app = require('./modules/app');

const server = require('http').Server(app);
const wss = new WebSocket.Server({ clientTracking: false, noServer: true });

server.listen(process.env.PORT || 5000);
