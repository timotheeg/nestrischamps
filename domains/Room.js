const EventEmitter = require('events');

class Room extends EventEmitter {
	constructor(owner) {
		super();

		this.owner = owner;
		this.views = new Set(); // connections
	}

	getOwner() {
		return this.owner;
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

	close(reason) {
		this.views.forEach(connection => connection.kick(reason));
		this.views.clear();
	}

	handleProducerMessage(user, message) {
		this.sendToViews(message);
	}
}

module.exports = Room;