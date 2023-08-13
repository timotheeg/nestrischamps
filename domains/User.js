import { EventEmitter } from 'node:events';
import PrivateRoom from './PrivateRoom.js';
import MatchRoom from './MatchRoom.js';
import Producer from './Producer.js';

// Twitch stuff
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';

const USER_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes before we destroy user! TODO: Make tunable
const LEAVE_ROOM_TIMEOUT = 30 * 1000; // allow 30s to reconnect

function is_spam(msg) {
	if (/bigfollows\s*.\s*com/i.test(msg)) return true;

	return /become famous/i.test(msg) && /buy/i.test(msg);
}

// Singleton Auth Provider for Twitch chats
class TwitchRefreshEmitter extends EventEmitter {}
const twitchRefreshEmitter = new TwitchRefreshEmitter();
const authProvider = new RefreshingAuthProvider({
	clientId: process.env.TWITCH_CLIENT_ID,
	clientSecret: process.env.TWITCH_CLIENT_SECRET,
	onRefresh: (userId, args) => {
		twitchRefreshEmitter.emit(userId, args);
	},
});

class User extends EventEmitter {
	constructor(user_object) {
		super();

		this.updateUserFields(user_object);

		this.producer = new Producer(this);

		// TODO: can room be setup lazily?
		this.private_room = new PrivateRoom(this);
		this.host_room = new MatchRoom(this);

		// match room links this user to the host room of another user
		this.match_room = null;
		this.match_room_join_ts = -1;
		this.leave_room_to = null;

		// keep track of all socket for the user
		// dangerous, could lead to memory if not managed well
		this.destroy_to = null;
		this.connections = new Set();

		this._handleProducerMessage = this._handleProducerMessage.bind(this);
		this._handleProducerClose = this._handleProducerClose.bind(this);
		this._handleMatchRoomClose = this._handleMatchRoomClose.bind(this);
		this._onTwitchTokenRefreshed = this._onTwitchTokenRefreshed.bind(this);

		this.producer.on('message', this._handleProducerMessage);
		this.producer.on('close', this._handleProducerClose);

		this.checkScheduleDestroy();
	}

	updateUserFields(user_object) {
		this.id = user_object.id;
		this.login = user_object.login;
		this.secret = user_object.secret;

		this.email = user_object.email;
		this.display_name = user_object.display_name;
		this.description = user_object.description;
		this.profile_image_url = user_object.profile_image_url;
		this.dob = user_object.dob;

		this.country_code = user_object.country_code || this.country_code || 'US';
		this.city = user_object.city || this.city || '';
		this.timezone = user_object.timezone || this.timezone || 'UTC';
		this.style = user_object.style || this.style || 'das';
		this.interests = user_object.interests || this.interests || '';
	}

	setProducerConnection(
		conn,
		{ match = false, competition = false, target_user = null }
	) {
		this.addConnection(conn);
		this.producer.setConnection(conn, { match, competition });

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
			this.leave_room_to = clearTimeout(this.leave_room_to); // just in case
			new_room.addProducer(this); // this forces a redispatch of the peer ids
			return;
		}

		if (this.match_room) {
			this.leaveMatchRoom();
		}

		this.match_room_join_ts = Date.now();
		this.match_room = new_room;
		this.match_room.addProducer(this);
		this.match_room.once('close', this._handleMatchRoomClose);
	}

	leaveMatchRoom() {
		this.leave_room_to = clearTimeout(this.leave_room_to);

		if (this.match_room) {
			this.match_room.off('close', this._handleMatchRoomClose);
			this.match_room.removeProducer(this);
			this.match_room = null;
			this.match_room_join_ts = -1;
		}
	}

	_handleMatchRoomClose() {
		this.leaveMatchRoom();

		if (this.producer.isMatchConnection()) {
			this.match_room_join_ts = -1;
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
		console.log(
			`checkScheduleDestroy() for user ${this.id}. Connections: ${this.connections.size}`
		);

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
			this._scheduleLeaveRoom();
		}
	}

	_scheduleLeaveRoom() {
		this.leave_room_to = clearTimeout(this.leave_room_to);
		this.leave_room_to = setTimeout(
			() => this.leaveMatchRoom(),
			LEAVE_ROOM_TIMEOUT
		);
	}

	send(msg) {
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
			delete this.chat_client;
			twitchRefreshEmitter.removeListener(
				this.id,
				this._onTwitchTokenRefreshed
			);
		}
	}

	_onTwitchTokenRefreshed({ accessToken, refreshToken, expiresIn }) {
		// How to update the session object(s) directly?
		this.token.access_token = accessToken;
		this.token.refresh_token = refreshToken;
		this.token.expires_in = expiresIn;
	}

	async _connectToTwitchChat() {
		if (this.chat_client || !this.token) {
			return;
		}

		const twurpleToken = {
			accessToken: this.token.access_token,
			refreshToken: this.token.refresh_token,
			expiresIn: 0,
			obtainmentTimestamp: 0,
		};

		twitchRefreshEmitter.addListener(this.id, this._onTwitchTokenRefreshed);
		authProvider.addUser(this.id, twurpleToken, [`chat:${this.id}`]);

		this.chat_client = new ChatClient({
			authProvider,
			authIntents: [`chat:${this.id}`],
			channels: [this.login],
			readOnly: true,
			logger: {
				minLevel: 'info',
			},
		});

		this.chat_client.onMessage((channel, user, message) => {
			if (is_spam(message)) {
				// TODO: find API to do ban user automatically
				return;
			}

			this.send([
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
			this.send([
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
			this.send([
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
