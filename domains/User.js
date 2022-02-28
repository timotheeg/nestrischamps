import EventEmitter from 'events';
import PrivateRoom from './PrivateRoom.js';
import MatchRoom from './MatchRoom.js';
import Producer from './Producer.js';

// Twitch stuff
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';

const USER_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes before we destroy user! TODO: Make tunable

function is_spam(msg) {
	if (/bigfollows\s*.\s*com/i.test(msg)) return true;

	return /become famous/i.test(msg) && /buy/i.test(msg);
}

class User extends EventEmitter {
	constructor(user_object) {
		super();

		this.id = user_object.id;
		this.login = user_object.login;
		this.secret = user_object.secret;
		this.email = user_object.email;
		this.display_name = user_object.display_name;
		this.description = user_object.description;
		this.profile_image_url = user_object.profile_image_url;

		this.dob = user_object.dob;
		this.country_code = user_object.country_code || 'US';
		this.city = user_object.city || '';
		this.timezone = user_object.timezone || 'UTC';
		this.style = user_object.style || 'das';
		this.interests = user_object.interests || '';

		this.producer = new Producer(this);

		// TODO: can room be setup lazily?
		this.private_room = new PrivateRoom(this);
		this.host_room = new MatchRoom(this);

		// match room links this user to the host room of another user
		this.match_room = null;

		// keep track of all socket for the user
		// dangerous, could lead to memory if not managed well
		this.destroy_to = null;
		this.connections = new Set();

		this._handleProducerMessage = this._handleProducerMessage.bind(this);
		this._handleProducerClose = this._handleProducerClose.bind(this);
		this._handleMatchRoomClose = this._handleMatchRoomClose.bind(this);

		this.producer.on('message', this._handleProducerMessage);
		this.producer.once('close', this._handleProducerClose);

		this.checkScheduleDestroy();
	}

	setProducerConnection(conn, { match = false, target_user = null }) {
		this.addConnection(conn);
		this.producer.setConnection(conn, { match });

		if (match) {
			this.joinMatchRoom(target_user);
		} else {
			this.leaveMatchRoom();
			this.makePlayer();
		}
	}

	getProducer() {
		return this.producer;
	}

	getPrivateRoom() {
		return this.private_room;
	}

	getHostRoom() {
		return this.host_room;
	}

	joinMatchRoom(host_user) {
		const new_room = host_user.getHostRoom();

		if (new_room === this.match_room) {
			// this forces a redispatch of the peer ids
			this.match_room.addProducer(this);
			return;
		}

		if (this.match_room) {
			this.leaveMatchRoom();
		}

		this.match_room = host_user.getHostRoom();
		this.match_room.addProducer(this);
		this.match_room.once('close', this._handleMatchRoomClose);
	}

	leaveMatchRoom() {
		if (this.match_room) {
			this.match_room.off('close', this._handleMatchRoomClose);
			this.match_room.removeProducer(this);
			this.match_room = null;
		}
	}

	_handleMatchRoomClose() {
		this.match_room = null;

		if (this.producer.isMatchConnection()) {
			this.producer.kick('match_room_closed');
		}
	}

	closeRooms(reason) {
		// send message to all connections in all rooms that rooms are going away
		this.private_room.close(reason);
		this.host_room.close(reason);
	}

	setTwitchToken(token) {
		// in memory only, not in DB
		this.token = token;
		this.token.expiry = new Date(Date.now() + token.expires_in * 1000);

		if (this.connections.length) {
			this._connectToTwitchChat();
		}
	}

	hasTwitchToken() {
		return !!this.token;
	}

	addConnection(conn) {
		this.connections.add(conn);

		conn.once('close', () => {
			this.connections.delete(conn);
			this.checkScheduleDestroy();
		});

		this.checkScheduleDestroy();
		this._connectToTwitchChat();
	}

	makePlayer() {
		if (this.match_room) {
			// TODO refactor
			console.log("there's a match room!");
			// match room manages webcam feed itself
			return;
		}

		console.log('isMatchConnection', this.getProducer().isMatchConnection());

		if (!this.getProducer().isMatchConnection()) {
			this.getProducer().send([
				'setViewPeerId',
				this.private_room.last_view_peer_id,
			]);
			this.getProducer().send([
				'makePlayer',
				0,
				this.private_room.last_view_meta,
			]);
		}
	}

	checkScheduleDestroy() {
		this.destroy_to = clearTimeout(this.destroy_to);

		if (this.connections.size > 0) return; // TODO: also check activity on the connections

		// User has no connection, we'll schedule his/her destruction
		this.destroy_to = setTimeout(() => this._onExpired(), USER_SESSION_TIMEOUT);
	}

	_handleProducerMessage(msg) {
		this.private_room.handleProducerMessage(this, msg);

		if (this.match_room) {
			this.match_room.handleProducerMessage(this, msg);
		}
	}

	_handleProducerClose() {
		if (this.match_room) {
			this.match_room.removeProducer(this);
			this.match_room = null;
		}
	}

	_send(msg) {
		const msg_str = JSON.stringify(msg);

		// TODO: maybe no need to send to producer and admin connections? 🤔
		for (const connection of this.connections) {
			connection.send(msg_str);
		}
	}

	_onExpired() {
		console.log(`User ${this.login} is expiring`);

		this.closeRooms('expired');
		this.emit('expired');

		if (this.chat_client) {
			this.chat_client.quit();
		}
	}

	async _connectToTwitchChat() {
		console.log('_connectToTwitchChat 1');

		if (this.chat_client || !this.token) {
			return;
		}

		console.log('_connectToTwitchChat 2');

		const authProvider = new RefreshingAuthProvider(
			{
				clientId: process.env.TWITCH_CLIENT_ID,
				clientSecret: process.env.TWITCH_CLIENT_SECRET,
				onRefresh: ({ accessToken, refreshToken, expiryDate }) => {
					// How to update the session object(s) directly?
					this.token.access_token = accessToken;
					this.token.refresh_token = refreshToken;
					this.token.expiry = expiryDate;
					this.token.expires_in = Math.max(
						0,
						Math.floor((expiryDate.getTime() - Date.now()) / 1000)
					);
				},
			},
			this.token
		);

		console.log('create chat client');

		this.chat_client = new ChatClient({
			authProvider,
			channels: [this.login],
			readOnly: true,
			logger: {
				minLevel: 'debug',
			},
		});

		this.chat_client.onMessage((channel, user, message) => {
			console.error.log('onMessage', user, message);
			if (is_spam(message)) {
				// TODO: find API to do ban user automatically
				return;
			}

			this._send([
				'message',
				{
					user: user,
					username: user,
					display_name: user,
					message: message || '',
				},
			]);
		});

		this.chat_client.onSub((channel, user) => {
			this._send([
				'message',
				{
					user: this.login,
					username: this.login,
					display_name: this.display_name,
					message: `Thanks to ${user} for subscribing to the channel!`,
				},
			]);
		});

		this.chat_client.onRaid((channel, user, raidInfo) => {
			this._send([
				'message',
				{
					user: this.login,
					username: this.login,
					display_name: raidInfo.displayName,
					message: `Woohoo! ${raidInfo.displayName} is raiding with a party of ${raidInfo.viewerCount}. Thanks for the raid ${raidInfo.displayName}!`,
				},
			]);
		});

		await this.chat_client.connect();

		console.log(`TWITCH: chat_client connected for ${this.login}`);
	}
}

export default User;
