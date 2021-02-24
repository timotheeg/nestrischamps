const _ = require('lodash');

const Room = require('./Room');

const PRODUCER_FIELDS = ['id', 'login', 'display_name', 'profile_image_url'];

class MatchRoom extends Room {
	constructor() {
		super();

		this.player1 = null;
		this.player2 = null;
		this.admin = null;
	}

	setAdmin(connection) {
		// producer can only be owner
		if (connection.user.id != this.owner.id) return false; // throw?

		// user is owner, he should take over connection
		this.admin.kick('concurrency_limit');
		this.admin.socket.removeAllListeners();

		this.admin = connection;

		connection.socket.on('message', this.onAdminMesssage);
		connection.socket.on('close', () => {
			connection.socket.removeListener('message', this.onAdminMesssage);
			if (this.admin == connection) {
				this.admin = null;
			}
		});
	}

	addProducer(connection) {
		// check if user is already connected
		const old_conn = [ ...this.producers ].find(conn => conn.user.id === connection.user.id);

		if (old_conn) {
			connection.kick();
			removeProducer(connection)
		}

		this.producers.add(connection);

		connection.socket.on('message', this.onProducerMesssage);
		connection.socket.on('close', () => this.removeProducer(connection));

		this.tellAdmin([
			"addProducer",
			_.pick(connection.user, PRODUCER_FIELDS)
		]);
	}

	removeProducer(connection) {
		connection.socket.removeListener('message', this.onProducerMesssage);
		this.producers.delete(connection);

		this.tellAdmin([
			"removeProducer",
			connection.user.id
		]);
	}

	// get state of the room:
	// list all connected producers
	// get current best of N count
	// list current victory point
	// list customization on avatars and names
	getState() {
		return {
			producers: [ ...this.producers ].map(conn => _.pick(connection.user, PRODUCER_FIELDS)),
			bestof: this.bestof,
			player_map: this.player_map,
		};
	}

	tellAdmin(message) {
		if (!this.admin) return;

		this.admin.send(message);
	}

	onAdminMessage(message) {
		const [command, ...args] = message;

		switch (command) {
			case 'setPeer':
				break;

			case 'setPlayer':
				break;

			case 'setName':
				break;

			case 'setAvatar':
				break;

			case 'setVictories':
				break;

			case 'setBestOf':
				break;
		}
	}
}

module.exports = MatchRoom;