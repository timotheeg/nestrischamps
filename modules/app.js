const path = require('path');
const express = require('express');
const { ExpressPeerServer } = require('peerjs-server');
const middlewares = require('./middlewares');
const app = express();

app.set('view engine', 'ejs');
app.set('trust proxy', 1) // trust first proxy (i.e. heroku) -- needed to get req.protocol correctly

app.use(express.static(path.join(__dirname, '../public')));
app.use(middlewares.sessionMiddleware);

app.use('/auth', require('../routes/auth'));
app.use('/stats', require('../routes/score'));
app.use('/settings', require('../routes/settings'));
app.use('', require('../routes/routes'));

module.exports = app;
