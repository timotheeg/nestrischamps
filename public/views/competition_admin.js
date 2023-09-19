import Connection from '/js/connection.js';

const dom = {
	roomid: document.querySelector('#roomid'),
	producer_count: document.querySelector('#producer_count'),
	bestof: document.querySelector('#bestof'),
	clear_victories: document.querySelector('#clear_victories'),
	show_runways: document.querySelector('#show_runways'),
	hide_runways: document.querySelector('#hide_runways'),
	focus_none: document.querySelector('#focus_none'),
	player_link: document.querySelector('#player_link'),
	show_match_controls: document.querySelector('#show_match_controls'),
	show_profile_cards_controls: document.querySelector(
		'#show_profile_cards_controls'
	),
	allow_autojoin: document.querySelector('#allow_autojoin'),
	add_player: document.querySelector('#add_player'),
	curtain_logo_url: document.querySelector('#curtain_logo_url'),
};

const MAX_BEST_OF = 13;

// TODO: refactor into dynamic getter
const remoteAPI = {
	setBestOf: function (n) {
		connection.send(['setBestOf', n]);
	},
	setCurtainLogo: function (url) {
		connection.send(['setCurtainLogo', url]);
	},
	addPlayer: function () {
		connection.send(['addPlayer']);
	},
	setPlayer: function (player_idx, user_id) {
		connection.send(['setPlayer', player_idx, user_id]);
	},
	setPlayerOnBehalfOfUser: function (player_idx, user_id) {
		connection.send(['setPlayerOnBehalfOfUser', player_idx, user_id]);
	},
	setVictories: function (player_idx, num_wins) {
		connection.send(['setVictories', player_idx, num_wins]);
	},
	setWinner: function (player_idx) {
		connection.send(['setWinner', player_idx]);
	},
	setGameOver: function (player_idx) {
		connection.send(['setGameOver', player_idx]);
	},
	cancelGameOver: function (player_idx) {
		connection.send(['cancelGameOver', player_idx]);
	},
	removePlayer: function (player_idx) {
		connection.send(['removePlayer', player_idx]);
	},
	setDisplayName: function (player_idx, name) {
		connection.send(['setDisplayName', player_idx, name]);
	},
	setProfileImageURL: function (player_idx, url) {
		connection.send(['setProfileImageURL', player_idx, url]);
	},
	setCountryCode: function (player_idx, country_code) {
		connection.send(['setCountryCode', player_idx, country_code]);
	},
	restartCamera: function (player_idx) {
		connection.send(['restartCamera', player_idx]);
	},
	mirrorCamera: function (player_idx) {
		connection.send(['mirrorCamera', player_idx]);
	},
	resetVictories: function () {
		connection.send(['resetVictories']);
	},
	showRunways: function () {
		connection.send(['showRunways']);
	},
	hideRunways: function () {
		connection.send(['hideRunways']);
	},
	playVictoryAnimation: function (player_idx) {
		connection.send(['playVictoryAnimation', player_idx]);
	},
	clearVictoryAnimation: function (player_idx) {
		connection.send(['clearVictoryAnimation', player_idx]);
	},
	setMatch: function (match_idx) {
		connection.send(['setMatch', match_idx]);
	},
	showProfileCard: function (visible, match_idx) {
		connection.send(['showProfileCard', visible, match_idx]);
	},
	allowAutoJoin: function (allow) {
		connection.send(['allowAutoJoin', allow]);
	},
	focusPlayer: function (player_idx) {
		connection.send(['focusPlayer', player_idx]);
	},
};

const players = [];
let room_data;
let connection;

function getProducer(pid) {
	return room_data.producers.find(producer => producer.id === pid);
}

class Player {
	constructor(idx, dom) {
		this.dom = dom;

		this.setIndex(idx);

		this.victories = 0;
		this.bestof = -1;

		// link dom events
		this.dom.name.onchange = this.dom.name.onkeyup = _.debounce(() => {
			remoteAPI.setDisplayName(this.idx, this.dom.name.value.trim());
		}, 750);

		this.dom.avatar_url.onchange = this.dom.avatar_url.onkeyup = _.debounce(
			() => {
				const avatar_url = this.dom.avatar_url.value.trim();

				remoteAPI.setProfileImageURL(this.idx, avatar_url);
				this.dom.avatar_img.src = avatar_url;
			},
			750
		);

		this.dom.country_code_select.onchange = () => {
			const country_code = this.dom.country_code_select.value;

			remoteAPI.setCountryCode(this.idx, country_code);
			this.setFlag(country_code);
		};

		this.dom.producers.onchange = () =>
			this._pickProducer(this.dom.producers.value);

		if (this.dom.users) {
			this.dom.users.onchange = () => {
				if (!this.dom.users.value) return;

				this._setPlayerOnBehalfOfUser(this.dom.users.value);
			};
		}

		this.dom.win_btn.onclick = () => {
			remoteAPI.setWinner(this.idx);
		};

		this.dom.game_over_btn.onclick = () => {
			remoteAPI.setGameOver(this.idx);
		};

		this.dom.cancel_game_over_btn.onclick = () => {
			remoteAPI.cancelGameOver(this.idx);
		};

		this.dom.remove_btn.onclick = () => {
			remoteAPI.removePlayer(this.idx);
		};

		this.dom.camera_restart_btn.onclick = () => {
			remoteAPI.restartCamera(this.idx);
		};

		this.dom.camera_mirror_btn.onclick = () => {
			remoteAPI.mirrorCamera(this.idx);
		};

		this.dom.focus_player_btn.onclick = () => {
			remoteAPI.focusPlayer(this.idx);
		};
	}

	setIndex(idx) {
		this.idx = idx;
		this.dom.num.textContent = idx + 1;
	}

	setFlag(country_code) {
		this.dom.country_code_img.src =
			this.dom.country_code_img.dataset.url.replace('{code}', country_code);
	}

	setProducers(producers) {
		this.dom.producers.innerHTML = '';

		const option = document.createElement('option');
		option.value = '';
		option.textContent = '-';
		this.dom.producers.appendChild(option);

		producers.forEach(producer => {
			const option = document.createElement('option');
			option.value = producer.id;
			option.textContent = producer.login;

			this.dom.producers.appendChild(option);
		});
	}

	setBestOf(n) {
		if (this.bestof === n) return;

		this.bestof = n;

		this.dom.victories.innerHTML = '';

		const heart = '&#338';
		const num_heart = Math.ceil(n / 2);
		const items = ['-', ...Array(num_heart).fill(heart)];

		items.forEach((content, idx) => {
			const span = document.createElement('span');

			span.innerHTML = content;
			span.onclick = () => this._pickVictories(idx);

			this.dom.victories.append(span);
		});
	}

	_pickProducer(pid) {
		remoteAPI.setPlayer(this.idx, pid);
	}

	_setPlayerOnBehalfOfUser(pid) {
		remoteAPI.setPlayerOnBehalfOfUser(this.idx, pid);
	}

	setProducer(pid) {
		const selected_pid = this.dom.producers.value;

		if (selected_pid === pid) return;

		const producer = getProducer(pid);

		this.dom.producers.value = pid;

		if (!producer) return;

		this.dom.name.value = producer.display_name;
		this.dom.avatar_url.value = producer.profile_image_url;
		this.dom.avatar_img.src = producer.profile_image_url;
	}

	_pickVictories(n) {
		remoteAPI.setVictories(this.idx, n);
	}

	setVictories(n) {
		this.victories = n;

		this.dom.victories.querySelectorAll('span').forEach((span, idx) => {
			if (idx && idx <= (n || 0)) {
				span.classList.add('win');
			} else {
				span.classList.remove('win');
			}
		});
	}

	setState(state) {
		this.setVictories(state.victories);
		this.setProducer(state.id);

		this.dom.name.value = state.display_name;
		this.dom.avatar_url.value = state.profile_image_url;
		this.dom.avatar_img.src = state.profile_image_url;

		this.dom.country_code_select.value = state.country_code;
		this.setFlag(state.country_code);
	}
}

function setBestOfOptions(n, selected) {
	const select = dom.bestof;

	for (; n >= 3; n -= 2) {
		const option = document.createElement('option');
		option.value = n;
		option.textContent = n;

		if (n === selected) {
			option.setAttribute('selected', 'selected');
		}

		select.prepend(option);
	}
}

function setState(_room_data) {
	room_data = _room_data;

	// room stats
	room_data.producers.sort((a, b) => a < b);

	dom.curtain_logo_url.value = room_data.curtain_logo;
	dom.bestof.value = room_data.bestof;
	dom.producer_count.textContent = room_data.producers.length;

	// synchronize with remote players
	while (players.length > room_data.players.length) {
		players.pop().dom.root.remove();
	}

	for (let idx = players.length; idx < room_data.players.length; idx++) {
		addPlayer();
	}

	players.forEach((player, idx) => {
		player.setIndex(idx);
		player.setProducers(room_data.producers);
		player.setBestOf(room_data.bestof);
		player.setState(room_data.players[idx]);
	});

	dom.show_match_controls.style.display = room_data.concurrent_2_matches
		? null
		: 'none';

	if (room_data.concurrent_2_matches) {
		switch (room_data.selected_match) {
			case 0:
				dom.show_match_controls.querySelector('#match_1').checked = true;
				break;
			case 1:
				dom.show_match_controls.querySelector('#match_2').checked = true;
				break;
			default:
				dom.show_match_controls.querySelector('#match_both').checked = true;
				break;
		}
	}

	dom.show_profile_cards_controls.querySelector('.matches').style.display =
		room_data.concurrent_2_matches ? null : 'none';

	dom.allow_autojoin.checked = !!room_data.autojoin;
}

function addPlayer() {
	const players_node = document.querySelector('#players');
	const player_template = document.getElementById('player');
	const player_node = document
		.importNode(player_template.content, true)
		.querySelector('.player');

	const player = new Player(players.length, {
		root: player_node,
		num: player_node.querySelector('.num'),
		producers: player_node.querySelector('.producers select'),
		users: player_node.querySelector('.users select'),
		name: player_node.querySelector('.name'),
		avatar_url: player_node.querySelector('input.avatar'),
		avatar_img: player_node.querySelector('img.avatar'),
		country_code_select: player_node.querySelector('select.country_code'),
		country_code_img: player_node.querySelector('img.country_code'),
		victories: player_node.querySelector('.victories'),
		win_btn: player_node.querySelector('.winner'),
		game_over_btn: player_node.querySelector('.game_over'),
		cancel_game_over_btn: player_node.querySelector('.cancel_game_over'),
		remove_btn: player_node.querySelector('.remove_player'),
		camera_restart_btn: player_node.querySelector('.camera_restart'),
		camera_mirror_btn: player_node.querySelector('.camera_mirror'),
		focus_player_btn: player_node.querySelector('.focus_player'),
	});

	players_node.appendChild(player_node);

	players.push(player);
}

function bootstrap() {
	// start with 2 players
	setBestOfOptions(MAX_BEST_OF, 3);

	dom.show_match_controls.style.display = 'none';

	dom.roomid.textContent = location.pathname.split('/')[3] || '_default';
	dom.producer_count.textContent = 0;

	dom.bestof.onchange = () =>
		remoteAPI.setBestOf(parseInt(dom.bestof.value, 10));

	dom.curtain_logo_url.onchange = () =>
		remoteAPI.setCurtainLogo(dom.curtain_logo_url.value);

	dom.clear_victories.addEventListener('click', () => {
		remoteAPI.resetVictories();
	});

	dom.show_runways.addEventListener('click', () => {
		remoteAPI.showRunways();
	});

	dom.hide_runways.addEventListener('click', () => {
		remoteAPI.hideRunways();
	});

	dom.focus_none.addEventListener('click', () => {
		remoteAPI.focusPlayer(null);
	});

	dom.add_player.addEventListener('click', () => {
		remoteAPI.addPlayer();
	});

	dom.show_match_controls.querySelectorAll('input').forEach(radio =>
		radio.addEventListener('click', () => {
			const value =
				dom.show_match_controls.querySelector('input:checked').value;
			remoteAPI.setMatch(value ? parseInt(value, 10) : null);
		})
	);

	dom.show_profile_cards_controls
		.querySelectorAll('input')
		.forEach(checkbox => {
			checkbox.addEventListener('click', function () {
				remoteAPI.showProfileCard(this.checked, this.value);
			});
		});

	dom.allow_autojoin.addEventListener('click', function () {
		remoteAPI.allowAutoJoin(this.checked);
	});

	// =====

	window.connection = connection = new Connection();

	connection.onMessage = function (message) {
		const [command, ...args] = message;

		switch (command) {
			case 'state': {
				setState(args[0]);
				break;
			}

			case 'setOwner': {
				const owner = args[0];
				const player_url = `${location.protocol}//${location.host}/room/u/${owner.login}/producer`;

				dom.player_link.href = player_url;
				dom.player_link.textContent = player_url;

				break;
			}

			case 'setViewMeta': {
				const owner = args[0];
				const player_url = `${location.protocol}//${location.host}/room/u/${owner.login}/producer`;

				dom.player_link.href = player_url;
				dom.player_link.textContent = player_url;

				break;
			}

			default: {
				console.log(`Received unknow command ${command}`);
			}
		}
	};
}

bootstrap();
