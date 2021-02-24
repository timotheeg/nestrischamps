const _ = require('lodash');

class Room {
	constructor(owner) {
		this.owner = owner;
		this.producers = new Set();
		this.views = new Set();

		this.onProducerMessage = this.onProducerMessage.bind(this);
		this.onAdminMessage = this.onAdminMessage.bind(this);
	}

	addView(connection) {
		this.views.add(connection);

		connection.socket.on('error', _.noop); // TODO: log
		connection.socket.on('close', () => {
			this.views.delete(connection);
			connection.socket.removeAllListeners();
		});
	}

	close() {
		// TODO: kick, disconnect, and remove all connections (views, producers, admins)
	}

	addProducer(connection) {}
	onProducerMessage() {}
	onAdminMessage() {}
}

module.exports = Room;