const _ = require('lodash');

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
		const producers = this.producers.entries();

		for (const entry of producers) {
			const producer = entry[0];

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

		connection.on('message', message => this.onProducerMessage(connection, message));
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