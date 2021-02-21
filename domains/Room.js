class Room {
	constructor(owner) {
		this.owner = owner;
		this.producers = new Set();
		this.views = new Set();
	}

	addProducer(connection) {}

	addView(connection) {
		this.views.add(connection);

		connection.socket.addListener('error', _.noop); // TODO: log
		connection.socket.addListener('close', () => {
			this.views.delete(connection);
		});
	}
}

module.exports = Room;