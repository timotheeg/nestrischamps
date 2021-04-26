const _ = require('lodash');

const Room = require('./Room');

const PRODUCER_FIELDS = ['id', 'login', 'display_name', 'profile_image_url'];

class MatchRoom extends Room {
	constructor(owner, roomid) {
		super(owner);

		this.admin = null;
		this.roomid = roomid || '_default';
		this.state = {
			bestof: 3,
			players: [ // flat user objects
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
			if (this.admin == connection) { // only overwrite self (for potential race conditions)
				this.admin = null;
			}
		});

		this.admin.send(['setOwner', {
			id:    this.owner.id,
			login: this.owner.login
		}]);
		this.sendStateToAdmin();
	}

	getProducerFields(connection) {
		return _.pick(connection.user, PRODUCER_FIELDS);
	}

	addProducer(connection) {
		const is_new_user = super.addProducer(connection);

		if (is_new_user) {
			this.sendStateToAdmin();
		}
	}

	removeProducer(connection, is_replace_flow = false) {
		const was_present = super.removeProducer(connection);

		if (was_present && !is_replace_flow) {
			this.sendStateToAdmin();
		}
	}

	addView(connection) {
		super.addView(connection);

		// do a room state dump for this new view
		connection.send(['setBestOf', this.state.bestof]);

		this.state.players.forEach((player, pidx) => {
			connection.send(['setId',              pidx, player.id]);
			connection.send(['setLogin',           pidx, player.login]);
			connection.send(['setDisplayName',     pidx, player.display_name]);
			connection.send(['setProfileImageURL', pidx, player.profile_image_url]);
			connection.send(['setVictories',       pidx, player.victories]);
		});
	}

	// get state of the room:
	// list all connected producers
	// get current best of N count
	// list current victory point
	// list customization on avatars and names
	getState() {
		return {
			producers: [ ...this.producers ].map(this.getProducerFields),
			...this.state
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
		const [command, ...args] = message;
		let forward_to_views = true;
		let update_admin = true;

		try {
			switch (command) {
				case 'getState': {
					forward_to_views = false;
					break;
				}

				case 'setPlayer': {
					const [p_num, p_id] = args;
					console.log('setPlayer()', p_id, typeof p_id)

					let player_data;
					let player_id = `${p_id}`;

					this.assertValidPlayer(p_num);

					if (!p_id) {
						player_data = {
							id: '',
							login: '',
							display_name: '',
							profile_image_url: '',
						}
					}
					else if (this.state.players[0].id === player_id) {
						player_data = this.state.players[0];
					}
					else if (this.state.players[1].id === player_id) {
						player_data = this.state.players[1];
					}
					else {
						const producer = this.getProducer(player_id);

						if (producer) {
							player_data = this.getProducerFields(producer);
						}
					}

					if (!player_data) {
						console.log(`Room ${this.roomid}: Player not found`);
						return;
					}

					this.state.players[p_num] = {
						...this.state.players[p_num],
						...player_data,
						victories: 0
					};

					// Send all data back to admin
					this.sendToViews(['setId',              p_num, player_data.id]);
					this.sendToViews(['setLogin',           p_num, player_data.login]);
					this.sendToViews(['setDisplayName',     p_num, player_data.display_name]);
					this.sendToViews(['setProfileImageURL', p_num, player_data.profile_image_url]);

					forward_to_views= false;
					break;
				}

				case 'setDisplayName': {
					const [p_num, name] = args;

					this.assertValidPlayer(p_num);

					this.state.players[p_num].display_name = name;

					break;
				}

				case 'setProfileImageURL': {
					const [p_num, url] = args;

					this.assertValidPlayer(p_num);

					this.state.players[p_num].profile_image_url = url;

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

					this.state.players[p_num].victories = url;

					break;
				}

				case 'setBestOf': {
					this.state.bestof = args[0];

					break;
				}

				case 'setWinner': {
					update_admin = false;

					break;
				}

				default: {
					return;
				}
			}

			if (forward_to_views) {
				this.sendToViews(message);
			}

			// update admins with latest state
			if (update_admin) {
				this.sendStateToAdmin();
			}
		}
		catch(err) {
			console.error(err);
		}
	}

	onProducerMessage(producer, message) {
		// system where you can have one user being both players
		[0, 1].forEach(p_num => {
			if (this.state.players[p_num].id === producer.user.id) {
				if (message instanceof Uint8Array) {
					message[0] = (message[0] & 0b11111000) | p_num; // sets player number in header byte of binary message
					this.sendToViews(message);
				}
				else {
					this.sendToViews(['frame', p_num, message]);
				}
			}
		});
	}

	close(reason) {
		super.close(reason);

		if (this.admin) {
			this.admin.kick(reason);
			this.admin = null;
		}
	}
}

module.exports = MatchRoom;