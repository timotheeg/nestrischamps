const _ = require('lodash');

class Room {
	constructor(owner) {
		this.owner = owner;
		this.producers = new Set();
		this.views = new Set();

		this.onProducerMessage = this.onProducerMessage.bind(this);
	}

	addView(connection) {
		this.views.add(connection);

		connection.on('close', () => this.views.delete(connection));
	}

	sendToViews(message) {
		this.views.forEach(connection => connection.send(message));
	}

	close() {}
	addProducer() {}
	onProducerMessage() {}
}

module.exports = Room;