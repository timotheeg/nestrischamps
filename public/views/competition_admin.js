const dom = {
	roomid:          document.querySelector('#roomid'),
	producer_count:  document.querySelector('#producer_count'),
	logo:            document.querySelector('#logo input'),
	bestof:          document.querySelector('#bestof'),
	clear_victories: document.querySelector('#clear_victories'),
	player_link:     document.querySelector('#player_link'),
};

const MAX_BEST_OF = 13;

const remoteAPI = {
	setBestOf: function(n) {
		connection.send(['setBestOf', n]);
	},
	setPlayer: function(player_idx, user_id) {
		connection.send(['setPlayer', player_idx, user_id]);
	},
	setVictories: function(player_idx, num_wins) {
		connection.send(['setVictories', player_idx, num_wins]);
	},
	setWinner: function(player_idx) {
		connection.send(['setWinner', player_idx]);
	},
	setDisplayName: function(player_idx, name) {
		connection.send(['setDisplayName', player_idx, name]);
	},
	setProfileImageURL: function(player_idx, url) {
		connection.send(['setProfileImageURL', player_idx, url]);
	},
	resetVictories: function() {
		connection.send(['resetVictories']);
	},
	playVictoryAnimation: function(player_idx) {
		connection.send(['playVictoryAnimation', player_idx]);
	},
	clearVictoryAnimation: function(player_idx) {
		connection.send(['clearVictoryAnimation', player_idx]);
	},
	setLogo: function(url) {
		connection.send(['setLogo', url]);
	}
};

let players;
let room_data;
let connection;


function getProducer(pid) {
	return room_data.producers.find(producer => producer.id == pid);
}

class Player {
	constructor(idx, dom) {
		this.idx = idx;
		this.dom = dom;

		this.victories = 0;
		this.bestof = -1;

		// link dom events
		this.dom.name.onchange
			= this.dom.name.onkeyup
			= this.dom.name.onblur
			= () => {
				remoteAPI.setDisplayName(this.idx, this.dom.name.value.trim());
			};

		this.dom.avatar_url.onchange
			= this.dom.avatar_url.onkeyup
			= this.dom.avatar_url.onblur
			= () => {
				const avatar_url = this.dom.avatar_url.value.trim();

				remoteAPI.setProfileImageURL(this.idx, avatar_url);
				this.dom.avatar_img.src = avatar_url;
			};

		this.dom.producers.onchange = () => this._pickProducer(parseInt(this.dom.producers.value, 10));

		this.dom.win_btn.onclick = () => {
			remoteAPI.setWinner(this.idx);
		}
	}

	setProducers(producers) {
		this.dom.producers.innerHTML = '';

		const option = document.createElement('option');
		option.value = '-';
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
		remoteAPI.setPlayer(this.idx, parseInt(pid, 10));
	}

	setProducer(pid) {
		const selected_pid = parseInt(this.dom.producers.value, 10);

		if (selected_pid === pid) return;

		const producer = getProducer(pid);

		this.dom.producers.value = pid

		if (!producer) return;

		this.dom.name.value = producer.display_name;
		this.dom.avatar_url.value = producer.profile_image_url;
		this.dom.avatar_img.src = producer.profile_image_url;
	}

	_pickVictories(n) {
		remoteAPI.setVictories(this.idx, n);
	}

	setVictories(n) {
		if (this.victories == n) return;

		this.victories = n;

		this.dom.victories.querySelectorAll('span').forEach((span, idx) => {
			if (idx && idx <= (n || 0)) {
				span.classList.add('win');
			}
			else {
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
	}
}

function setBestOfOptions(n, selected) {
	const select = dom.bestof;

	for (;  n >= 3; n -= 2) {
		const option = document.createElement('option');
		option.value = n;
		option.textContent = n;

		if (n === selected) {
			option.setAttribute('selected', 'selected')
		}

		select.prepend(option);
	}
}

function setState(_room_data) {
	room_data = _room_data;

	// room stats
	room_data.producers.sort((a, b) => a < b);

	dom.producer_count.textContent = room_data.producers.length;

	players.forEach((player, idx) => {
		player.setProducers(room_data.producers);
		player.setBestOf(room_data.bestof);
		player.setState(room_data.players[idx]);
	});
}

function bootstrap() {
	players = [1, 2].map(num => new Player(num - 1, {
		producers:  document.querySelector(`#producers .p${num} select`),
		name:       document.querySelector(`#names .p${num} input`),
		avatar_url: document.querySelector(`#avatar_urls .p${num} input`),
		avatar_img: document.querySelector(`#avatars .p${num} img`),
		victories:  document.querySelector(`#victories .p${num}`),
		win_btn:    document.querySelector(`#wins .p${num} button`),
	}));

	setBestOfOptions(MAX_BEST_OF, 3);

	dom.roomid.textContent = location.pathname.split('/')[3] || '_default';
	dom.producer_count.textContent = 0;

	dom.bestof.onchange = () => remoteAPI.setBestOf(parseInt(dom.bestof.value, 10));

	dom.logo.onchange
		= logo.onkeyup
		= logo.onkeydown
		= logo.onblur
		= () => remoteAPI.setLogo(dom.logo.value.trim());

	dom.clear_victories.addEventListener('click', () => remoteAPI.resetVictories());

	// =====

	connection = new Connection();

	connection.onMessage = function(message) {
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

			default: {
				console.log(`Received unknow command ${command}`);
			}
		}
	};
}

bootstrap();

