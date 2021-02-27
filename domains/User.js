const EventEmitter = require('events');

const PrivateRoom = require('./PrivateRoom');
const MatchRoom = require('./MatchRoom');

const USER_SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes before we destroy user! TODO: Make tunable

class User extends EventEmitter{
	constructor(user_object) {
		super();

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

	closeRooms(reason) {
		// send message to all connections in all rooms that rooms are going away
		if (this.private_room) this.private_room.close(reason);
		if (this.match_room) this.match_room.close(reason);
	}

	addConnection(conn) {
		this.connections.add(conn);

		conn.on('close', () => {
			this.connections.delete(conn);
			this.checkScheduleDestroy();
		});

		this.checkScheduleDestroy();
	}

	checkScheduleDestroy() {
		this.destroy_to = clearTimeout(this.destroy_to);

		if (this.connections.size > 0) return; // TODO: also check acticvity on the connections

		// User has no connection, we'll schedule his/her destruction
		this.destroy_to = setTimeout(
			this._onExpired,
			USER_SESSION_TIMEOUT
		);
	}

	_onExpired() {
		this.closeRooms('expired');
		this.emit('expired');
	}
}

module.exports = User;