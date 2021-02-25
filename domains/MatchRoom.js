const _ = require('lodash');

const Room = require('./Room');

const PRODUCER_FIELDS = ['id', 'login', 'display_name', 'profile_image_url'];

class MatchRoom extends Room {
	constructor(owner) {
		super(owner);

		this.getProducerFields = this.getProducerFields.bind(this);

		this.state = {
			bestof: 3,
			players: [
				{
					id: '',
					login: '',
					display_name: '',
					profile_image_url: '',
					victories: 0,
				},
				{
					id: '',
					login: '',
					display_name: '',
					profile_image_url: '',
					victories: 0,
				},
			]
		};

		this.admin = null;

		this.onAdminMessage = this.onAdminMessage.bind(this);
	}

	setAdmin(connection) {
		// Only owner can be admin
		if (connection.user.id != this.owner.id) {
			connection.kick('forbidden');
			return;
		}

		if (this.admin) {
			this.admin.kick('concurrency_limit');
		}

		this.admin = connection;

		connection.on('message', this.onAdminMessage);
		connection.on('close', () => {
			if (this.admin == connection) {
				this.admin = null;
			}
		});

		// Send the room state to admin
		this.sendStateToAdmin();
	}

	getProducer(user_id) {
		return [ ...this.producers ].find(conn => conn.user.id === user_id);
	}

	getProducerFields(connection) {
		return _.pick(connection.user, PRODUCER_FIELDS);
	}

	addProducer(connection) {
		// Check if user is already connected
		const old_conn = this.getProducer(connection.user.id);

		const inform_admin = !old_conn;

		if (old_conn) {
			old_conn.kick('concurrency_limit');
			this.removeProducer(old_conn, false);
		}

		this.producers.add(connection);

		connection.on('message', message => this.onProducerMessage(connection, message));
		connection.on('close', () => this.removeProducer(connection));

		if (inform_admin) {
			this.tellAdmin([
				"_addProducer",
				_.pick(connection.user, PRODUCER_FIELDS)
			]);
		}
	}

	removeProducer(connection, inform_admin=true) {
		this.producers.delete(connection);

		if (inform_admin) {
			this.tellAdmin([
				"_removeProducer",
				connection.user.id
			]);
		}
	}

	// get state of the room:
	// list all connected producers
	// get current best of N count
	// list current victory point
	// list customization on avatars and names
	getState() {
		return {
			producers: [ ...this.producers ].map(this.getProducerFields),
			state: this.state
		};
	}

	sendStateToAdmin() {
		this.tellAdmin(['state', this.getState()]);
	}

	tellAdmin(message) {
		if (!this.admin) return;

		this.admin.send(message);
	}

	assertValidPlayer(p_num) {
		if (p_num === 0 || p_num === 1) return true;

		throw new RangeError(`Player number is invalid (${p_num})`);
	}

	onAdminMessage(message) {
		console.log('onAdminMessage', message);

		const [command, ...args] = message;
		let forward_to_views = true;

		console.log('command', command);

		try {
			switch (command) {
				case 'getState': {
					forward_to_views = false;
					this.sendStateToAdmin();
				}

				case 'setPlayer': {
					console.log('matched');
					console.log(this.getState());

					const [p_num, p_id] = args;
					let player_data;

					this.assertValidPlayer(p_num);

					if (this.state.players[0].id === p_id) {
						player_data = this.state.players[0];
					}
					else if (this.state.players[1].id === p_id) {
						player_data = this.state.players[1];
					}
					else {
						const producer = this.getProducer(p_id);

						if (producer) {
							player_data = this.getProducerFields(producer);
						}
					}

					if (!player_data) {
						console.log('player not found');
						return;
					}

					this.state.players[p_num] = {
						...this.state.players[p_num],
						...player_data,
						victories: 0
					};

					// Send all data back to admin
					this.sendStateToAdmin();

					this.sendToViews(['setId',              p_num, player_data.id]);
					this.sendToViews(['setLogin',           p_num, player_data.login]);
					this.sendToViews(['setDisplayName',     p_num, player_data.display_name]);
					this.sendToViews(['setProfileImageURL', p_num, player_data.profile_image_url]);

					console.log(this.getState());

					return;
				}

				case 'setDisplayName': {
					const [p_num, name] = args;

					this.assertValidPlayer(p_num);

					this.players[p_num].display_name = name;
					break;
				}

				case 'setProfileImageURL': {
					const [p_num, url] = args;

					this.assertValidPlayer(p_num);

					this.players[p_num].profile_image_url = url;
					break;
				}

				case 'resetVictories': {
					this.state.players[0].victories = 0;
					this.state.players[1].victories = 0;

					break;
				}

				case 'setVictories': {
					const [p_num, url] = args;

					this.assertValidPlayer(p_num);

					this.players[p_num].profile_image_url = url;
					break;
				}

				case 'setBestOf': {
					this.state.bestof = args[0];
					break;
				}

				default: {
					forward_to_views = false;
				}
			}

			if (forward_to_views) {
				this.sendToViews(message);
			}
		}
		catch(err) {
			console.error(err);
		}
	}

	onProducerMessage(producer, message) {
		// system where you can have one plyer
		[0, 1].forEach(p_num => {
			if (this.state.players[p_num].id === producer.user.id) {
				if (message instanceof Uint8Array) {
					message[0] |= p_num; // sets player number in header byte of binary message
					this.sendToViews(message);
				}
				else {
					message.player_num = p_num;
					this.sendToViews(['frame', message]);
				}
			}
		});
	}
}

module.exports = MatchRoom;