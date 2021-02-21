// thin wrapper above websocket to handle destruction

const _ = require('lodash');

const KICK_DESTROY_DELAY = 3000; // allows UI to get message and know it should not attempt to reconnect
const PING_INTERVAL = 15000;
const PONG_TIMEOUT = 60000;

class Connection {
	constructor(user, socket) {
		this.user = user;
		this.socket = socket;

		this.onHeartBeat = this.onHeartBeat.bind(this);
		this.ping = this.ping.bind(this);
		this.destroy = this.destroy.bind(this);

		this.socket.on('error', _.noop); // TODO: log?
		this.socket.on('ping', this.onHeartBeat);
		this.socket.on('pong', this.onHeartBeat);
		this.socket.on('close', this.destroy);

		this.onHeartBeat();
	}

	kick(reason) {
		this.socket.send(['kick', reason]);
		this.socket.removeAllListeners();
		this.ping_to = clearInterval(this.ping_int);
		this.kick_to = setTimeout(this.destroy, KICK_DESTROY_DELAY);
	}

	ping() {
		this.is_alive = false;
		this.socket.ping(_.noop);
	}

	onHeartBeat() {
		this.is_alive = true;
		this.ping_to = clearTimeout(this.ping_int);
		this.ping_to = setTimeout(this.ping, PING_INTERVAL);
	}

	destroy() {
		this.is_alive = false;
		this.ping_to = clearTimeout(this.ping_int);
	}
}

module.exports = Connection;