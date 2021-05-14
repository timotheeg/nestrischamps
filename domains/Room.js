const _ = require('lodash');

class Room {
	constructor(owner) {
		this.owner = owner;
		this.producers = new Set(); // users
		this.views = new Set(); // connections

		this.message_forwarders = new Map();
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

	hasProducer(user) {
		return this.producer.has(user);
	}

	addProducer(user) {
		const is_new_user = !this.hasProducer(user);

		if (!is_new_user) {
			this.producers.add(user);

			const forwarder = (message) => {
				this.onProducerMessage(user, message);
			};

			this.message_forwarders.set(user, forwarder);
			user.getProducer().on('message', forwarder);
		}

		return is_new_user;
	}

	removeProducer(user) {
		if (this.hasProducer(user)) {
			const forwarder = this.message_forwarders.get(user);

			user.getProducer().removeListener('message', forwarder);

			this.message_forwarders.delete(user);
			this.producers.delete(user);
		}
	}

	close(reason) {
		this.views.forEach(connection => connection.kick(reason));
		this.views.clear();

		// dodgy iteration that empties the collection as it goes -_-
		this.producers.forEach(user => {
			this.removeProducer(user);
		});
		this.producers.clear(); // not needed, but added for clarity
	}

	onProducerMessage() {}
}

module.exports = Room;