const PrivateRoom = require('./PrivateRoom');
const MatchRoom = require('./MatchRoom');

const USER_SESSION_TIMEOUT = 2 * 60 * 1000; // 1 minute before we destroy user! TODO: Make tunable

class User {
	constructor(user_object) {
		this.id = user_object.id;
		this.login = user_object.login;
		this.secret = user_object.secret;
		this.email = user_object.email;

		this.display_name = user_object.display_name;
		this.description = user_object.description;
		this.profile_image_url = user_object.profile_image_url;

		// TODO: create rooms lazily
		this.private_room = new PrivateRoom(this);
		this.match_room = new MatchRoom(this);

		// keep track of all socket for the user
		// dangerous, could lead to memory if not managed well
		this.destroy_to = null;
		this.connections = new Set();

		this.checkScheduleDestroy();
	}

	getPrivateRoom() {
		return this.private_room;
	}

	getMatchRoom() {
		return this.match_room;
	}

	closeRooms() {
		// send message to all connections in all rooms that rooms are going away
		if (this.private_room) this.private_room.close();
		if (this.match_room) this.match_room.close();
	}

	addConnection(conn) {
		this.connections.add(conn);

		conn.socket.on('close', () => {
			this.connections.delete(conn);
			this.checkScheduleDestroy();
		});

		this.checkScheduleDestroy();
	}

	checkScheduleDestroy() {
		this.destroy_to = clearTimeout(this.destroy_to);

		if (this.connections.size > 0) return;

		// User has no connection, we'll schedule his/her destruction
		this.destroy_to = setTimeout(() => this.onExpired(), USER_SESSION_TIMEOUT);
	}

	// TODO: use EventEmitter instead
	onExpired() {}
}

module.exports = User;