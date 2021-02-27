const _ = require('lodash');

const Room = require('./Room');

class PrivateRoom extends Room {
	constructor(owner) {
		super(owner);
	}

	addProducer(connection) {
		// Only Owners can be producer of their private room
		if (connection.user.id != this.owner.id) {
			connection.kick('not_allowed');
			return false; // throw?
		}

		super.addProducer(connection);
	}

	// Straight passthrough from producer to view
	// Basically, we assume producer is just sending game frames
	onProducerMessage(connection, message) {
		this.sendToViews(message);
	}
}

// API aliases:
PrivateRoom.prototype.setProducer = PrivateRoom.prototype.addProducer;

module.exports = PrivateRoom;