const EventEmitter = require('events');

const _ = require('lodash');
const Game = require('../modules/Game');

class Producer extends EventEmitter {
	constructor(user) {
		super();

		this.user = user;

		this.connection = null;
		this.game = null;

		this._handleMessage = this._handleMessage.bind(this);
	}

	setConnection(connection) {
		this.kick('concurrency_limit');

		connection.on('message', this._handleMessage);

		connection.once('close', () => {
			this.connection.removeAllListeners();

			if (this.connection === connection) {
				this.connection = null;
				this.endGame();
				this.emit('close');
			}
		});

		connection.once('error', err => {
			this.endGame();
			this.emit('error', err);
		});

		this.connection = connection;
	}

	hasConnection() {
		return !!this.connection;
	}

	setGame() {
		if (this.game) {
			delete this.game.onNewGame;
		}

		this.game = new Game(this.user);

		this.game.onNewGame = (frame) => {
			console.log(`${this.user.id} is starting a new game`);

			this.setGame();

			this.game.setFrame(frame);
		}
	}

	endGame() {
		if (this.game) {
			this.game.end();
			this.game = null;
		}
	}

	kick(reason) {
		if (this.connection) {
			this.connection.kick(reason);
			this.endGame();
		}
	}

	getPeerId() {
		return this.connection.id;
	}

	send(message) {
		if (this.connection) {
			this.connection.send(message);
		}
	}

	_handleMessage(message) {
		if (!this.game) {
			this.setGame();
		}

		if (message instanceof Uint8Array) {
			// this is a game frame, we track it in the game instance
			this.game.setFrame(message); // this call may reset the game as side effect
		}

		this.emit('message', message);
	}
}

module.exports = Producer;