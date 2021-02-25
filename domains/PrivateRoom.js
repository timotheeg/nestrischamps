const _ = require('lodash');

const Room = require('./Room');

class PrivateRoom extends Room {
	constructor(owner) {
		super(owner);
	}

	setProducer(connection) {
		// Only Owner can be Producer
		if (connection.user.id != this.owner.id) {
			connection.kick('not_allowed');
			return false; // throw?
		}

		// User is owner, new connection takes over any existing connections
		this.producers.forEach(connection => connection.kick('concurrency_limit'));
		this.producers.clear();

		this.producers.add(connection);

		connection.on('message', this.onProducerMesssage);
		connection.on('close', () => this.producers.delete(connection));
	}

	// Straight passthrough from producer to view
	// Basically, we assume producer is just sending game frames
	onProducerMesssage(message) {
		this.sendToViews(message);
	}
}

module.exports = PrivateRoom;