const EventEmitter = require('events');

const _ = require('lodash');
const Game = require('../modules/Game');

class Producer extends EventEmitter {
	constructor(user) {
		this.user = user;

		this.connection = null;
		this.game = null;
	}

	setConnection(connection) {
		if (this.connection) {
			this.connection.kick('concurrency_limit');
			this.endGame();
		}

		connection.on('message', message => {
			if (!this.game) {
				this.setGame();
			}

			if (message instanceof Uint8Array) {
				// this is a game frame, we track it in the game instance
				this.game.setFrame(message); // this call may reset the game as side effect
			}

			this.emit('message', message);
		});

		connection.on('close', () => {
			if (this.connection === connection) {
				this.connection = null;
				this.endGame();
				this.emit('close');
			}
		});

		connection.on('error', err => {
			this.endGame();
			this.emit('error', err);
		});

		this.connection = connection;
	}

	setGame() {
		if (this.game) {
			delete this.game.onNewGame;
		}

		this.game = new Game(connection.user);

		this.game.onNewGame = (frame) => {
			console.log(`${this.user.id} is starting a new game`);

			this.setGame();

			this.game.setFrame(frame);
		}

		connection.game = game;
	}

	endGame() {
		if (this.game) {
			this.game.end();
			this.game = null;
		}
	}
}