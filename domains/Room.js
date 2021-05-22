const _ = require('lodash');
const Game = require('../modules/Game');


function setGame(connection) {
	if (connection.game) {
		delete connection.game.onNewGame;
		delete connection.game;
	}

	const game = new Game(connection.user);

	game.onNewGame = (frame) => {
		console.log(`${connection.user.id} is starting a new game`);

		setGame(connection); // sets a new game onto connection - Spaghetti code!

		connection.game.setFrame(frame);
	}

	connection.game = game;
}

class Room {
	constructor(owner) {
		this.owner = owner;
		this.producers = new Set();
		this.views = new Set();
	}

	addView(connection) {
		this.views.add(connection);

		connection.on('close', () => this.removeView(connection));
	}

	removeView(connection) {
		return this.views.delete(connection);
	}

	sendToViews(message) {
		this.views.forEach(connection => connection.send(message));
	}

	getProducer(user_id) {
		console.log('searching', user_id, typeof user_id)

		const producers = this.producers.entries();

		for (const entry of producers) {
			const producer = entry[0];

			console.log('checking', producer.user.id, typeof producer.user.id);

			if (producer.user.id === user_id) {
				return producer;
			}
		}

		return null;
	}

	addProducer(connection) {
		// There can only be one producer per user in a room
		// Last connection wins
		const old_connection = this.getProducer(connection.user.id);
		let is_new_user = true;

		if (old_connection) {
			old_connection.kick('concurrency_limit');
			this.removeProducer(old_connection, true);
			is_new_user = false;
		}

		this.producers.add(connection);


		connection.on('message', message => {
			if (!connection.game) {
				setGame(connection);
			}


			if (message instanceof Uint8Array) {
				// this is a game frame, we track it in the game instance
				connection.game.setFrame(message); // this call may reset the game as side effect
			}

			this.onProducerMessage(connection, message)
		});

		connection.on('close', () => this.removeProducer(connection));

		return is_new_user;
	}

	removeProducer(connection) {
		return this.producers.delete(connection);
	}

	close(reason) {
		this.views.forEach(connection => connection.kick(reason));
		this.views.clear();

		this.producers.forEach(connection => connection.kick(reason));
		this.producers.clear();
	}

	onProducerMessage() {}
}

module.exports = Room;