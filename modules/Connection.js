// thin wrapper above websocket to handle destruction

const _ = require('lodash');
const EventEmitter = require('events');
const ULID = require('ulid');

const BinaryFrame = require('../public/js/BinaryFrame');

const KICK_DESTROY_DELAY = 1000; // allows UI to get message and know it should not attempt to reconnect
const PING_INTERVAL = 15000;

const WS_CODES = {
	KICK: 4000,
};

class Connection extends EventEmitter {
	constructor(user, socket, meta = new URLSearchParams()) {
		super();

		this.id = `NTC${ULID.ulid()}`; // NTC prefix for NesTrisChamps
		this.user = user;
		this.socket = socket;

		// convert the incoming meta to a pojo, not sure if wise
		// but we expect the meta to be serialized often-ish, so might as well pojo-ify it just once
		this.meta = {};

		meta.forEach((value, key) => {
			this.meta[key] = value;
		});

		this.broken = false;

		this._onMessage = this._onMessage.bind(this);
		this._onError = this._onError.bind(this);
		this._onClose = this._onClose.bind(this);
		this._onHeartBeat = this._onHeartBeat.bind(this);

		this.ping = this.ping.bind(this);

		this.socket.on('message', this._onMessage);
		this.socket.on('error', this._onError); // TODO: log?
		this.socket.on('ping', this._onHeartBeat);
		this.socket.on('pong', this._onHeartBeat);
		this.socket.on('close', this._onClose);

		this._onHeartBeat();

		this.send([
			'_init',
			{
				server_ts: Date.now(),
				id: this.id,
			},
		]);

		// for backward compatibility
		// TODO: remove after a while
		this.send(['_id', this.id]);
	}

	send(message) {
		if (this.socket) {
			if (Array.isArray(message)) {
				message = JSON.stringify(message);
			}
			// else assumes binary

			this.socket.send(message);
		}
	}

	// When a connection is kicked it can never again emit messages
	// makes cleaning up listener on consumers easier
	kick(reason) {
		this.socket.send(JSON.stringify(['_kick', reason]));
		this.doClose(WS_CODES.KICK, reason);
		this.kick_to = setTimeout(
			() => this._destroy(WS_CODES.KICK, reason),
			KICK_DESTROY_DELAY
		);
	}

	ping() {
		this.is_alive = false;
		this.socket.ping(_.noop); // TODO: handle pingt timeout (pong not coming back)
	}

	doClose(code, reason) {
		// Disable ping
		this.ping_to = clearTimeout(this.ping_to);

		// Render socket "harmless"
		this.socket.removeAllListeners();

		// Artifical close event for clients to cleanup
		this.emit('close', code, reason);
	}

	_onMessage(message) {
		if (message instanceof Uint8Array) {
			// binary frames are always game frames
			try {
				message = BinaryFrame.getFrameFromBuffer(message); // throws if message is invalid
			} catch (err) {
				console.warn(`Unable to process binary frame: ${err.message}`);
				return;
			}
		} else {
			try {
				message = JSON.parse(message);
			} catch (err) {
				console.warn(
					`Received non JSON message on connection ${this.id}: ${message
						.toString()
						.substr(1, 60)}`
				);
				return;
			}
		}

		try {
			this.emit('message', message);
		} catch (err) {
			console.warn(`Error while processing msg: ${err.message}`);
		}
	}

	_onError(err) {
		// What to do here? :(
		console.error(err);
	}

	_onHeartBeat() {
		this.is_alive = true;
		this.ping_to = clearTimeout(this.ping_to);
		this.ping_to = setTimeout(this.ping, PING_INTERVAL);
	}

	_onClose(code = 1000, reason = '') {
		this.doClose(code, reason);
		this._destroy(code, reason);
	}

	_destroy(code = 1000, reason = '') {
		this.ping_to = clearTimeout(this.ping_to);
		this.kick_to = clearTimeout(this.kick_to);
		this.socket.close(code, reason);
	}
}

module.exports = Connection;
