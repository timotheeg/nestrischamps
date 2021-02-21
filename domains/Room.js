class Room {
	constructor(owner) {
		this.owner = owner;
		this.producers = new Set();
		this.views = new Set();
	}

	addProducer(connection) {}

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
}

module.exports = Room;