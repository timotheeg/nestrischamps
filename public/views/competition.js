import QueryString from '/js/QueryString.js';
import Connection from '/js/connection.js';
import {
	TRANSITIONS,
	DOM_DEV_NULL,
	peerServerOptions,
} from '/views/constants.js';

// very simple RPC system to allow server to send data to client

let players;
let playerMap = null;

// Hack for CTWC Das -> allow mapping players to be players 1 and 2 in the renderer
if (/^[1-9]{2}$/.test(QueryString.get('playermap'))) {
	playerMap = QueryString.get('playermap')
		.split('')
		.reduce((acc, num, idx) => {
			acc[parseInt(num, 10) - 1] = idx;
			return acc;
		}, {});
}

function getPlayerIndexFromPlayerMap(idx) {
	if (idx in playerMap) {
		return playerMap[idx];
	} else {
		throw new RangeError('Player index not suported');
	}
}

function getPlayer(idx) {
	if (playerMap) {
		idx = getPlayerIndexFromPlayerMap(idx);
	}

	return players[idx];
}

function tetris_value(level) {
	return 1200 * (level + 1);
}

function getSortedPlayers(players, getter = 'getScore') {
	return players.concat().sort((p1, p2) => {
		const p1_score = p1[getter]();
		const p2_score = p2[getter]();

		if (isNaN(p1_score)) return -1;
		if (isNaN(p2_score)) return 1;

		return p2_score - p1_score;
	});
}

export function getTetrisDiff(leader, laggard, getter = 'getScore') {
	const leader_score = leader[getter]();
	const laggard_score = laggard[getter]();

	if (leader_score === laggard_score) return 0;
	if (!laggard.game?.data) return 0; // stupid value 🤷

	const start_level = laggard.game.data.start_level;
	const transition = TRANSITIONS[start_level];

	let { lines, level } = laggard.game.data;
	let tetrises = 0;
	let diff = leader_score - laggard_score;

	while (diff > 0) {
		if (lines >= transition - 4) {
			// below transition, level doesn't change every 10 lines
			if (lines % 10 >= 6) {
				// the tetris is counted at end level, not start level
				level += 1;
			}
		}

		lines += 4;
		tetrises += 1;

		diff -= tetris_value(level);
	}

	//  correct the overshot
	//  note: diff is negative, to this statement *reduces* the tetrises value
	tetrises += diff / tetris_value(level);

	return tetrises;
}

class TetrisCompetitionAPI {
	constructor() {
		this.first_to = 3; // defaults to Best of 5

		this.resetVictories(false);
	}

	resetVictories(clear_field = true) {
		this.victories = players.map(p => 0);

		players.forEach((player, idx) => {
			this._repaintVictories(idx);
			if (clear_field) player.clearField();
		});
	}

	setId(player_idx, id) {
		getPlayer(player_idx).setId(id);
	}

	setPeerId(player_idx, peerid) {
		getPlayer(player_idx).setPeerId(peerid);
	}

	setLogin(player_idx, login) {
		getPlayer(player_idx).setLogin(login);
	}

	setName(player_idx, name) {
		getPlayer(player_idx).setName(name);
	}

	setAvatar(player_idx, avatar_url) {
		getPlayer(player_idx).setAvatar(avatar_url);
	}

	// Twitch like command aliases
	setProfileImageURL(player_idx, avatar_url) {
		this.setAvatar(player_idx, avatar_url);
	}

	setDisplayName(player_idx, name) {
		this.setName(player_idx, name);
	}

	setCountryCode(player_idx, code) {
		getPlayer(player_idx).setCountryCode(code);
	}

	setCameraState(player_idx, camera_state) {
		getPlayer(player_idx).setCameraState(camera_state);
	}

	setFirstTo(num_games_to_win) {
		this.first_to = num_games_to_win;

		this.victories.forEach((num, idx) => {
			this.setVictories(idx, num, true);
		});
	}

	setBestOf(num_games) {
		this.setFirstTo(Math.ceil(num_games / 2));
	}

	setVictories(player_idx, num_victories, ignorePlayerMap = false) {
		if (playerMap && !ignorePlayerMap) {
			player_idx = getPlayerIndexFromPlayerMap(player_idx);
		}

		this.victories[player_idx] = num_victories;

		this._repaintVictories(player_idx);
	}

	setWinner(player_idx) {
		if (playerMap) {
			player_idx = getPlayerIndexFromPlayerMap(player_idx);
		}

		players.forEach((player, pidx) => {
			if (pidx === player_idx) {
				player.playWinnerAnimation();
			} else {
				player.showLoserFrame();
			}
		});
	}

	showProfileCard(visible) {
		players.forEach(player => player.showProfileCard(visible));
	}

	setGameOver(player_idx) {
		getPlayer(player_idx).setGameOver();
	}

	cancelGameOver(player_idx) {
		getPlayer(player_idx).cancelGameOver();
	}

	setCurtainLogo(url) {
		players.forEach(player => player.setCurtainLogo(url));
	}

	_repaintVictories(player_idx) {
		const player = players[player_idx]; // direct access... not great
		const victories = this.victories[player_idx];
		const hearts = player.dom.hearts;

		if (!hearts || !hearts.childNodes) return;

		// clear all the hearts
		while (hearts.childNodes.length) {
			hearts.removeChild(hearts.childNodes[0]);
		}

		// reset to specified value
		for (let idx = 0; idx < this.first_to; idx++) {
			const heart = document.createElement('span');

			heart.innerHTML = '&#338;'; // represented as a heart in the font

			if (idx < victories) {
				heart.classList.add('win');
			}

			const insert_method = player.render_wins_rtl ? 'prepend' : 'appendChild';

			hearts[insert_method](heart);
		}
	}

	frame(player_idx, data) {
		const player = getPlayer(player_idx);

		if (!player) return;

		player.setFrame(data);
	}

	setSecondaryView() {
		// Implemented conditionally in competition class below
	}

	scoreRecorded() {
		// only relevant for single player layouts
	}
}

// TODO: modularize this file better
export default class Competition {
	constructor(_players, api_overrides = {}) {
		this.players = players = _players;

		this._onPlayerScoreChanged = this._onPlayerScoreChanged.bind(this);

		try {
			this.has_video = !!(
				QueryString.get('video') !== '0' && view_meta.get('video')
			); // view_meta is a JS global (if it exists!) -- sort of gross
			this.view_meta = view_meta;
		} catch (err) {
			this.has_video = false;
			this.view_meta = new URLSearchParams({});
		}

		_players.forEach(player => {
			player.onScore = this._onPlayerScoreChanged;
		});

		this.API = new TetrisCompetitionAPI();

		Object.assign(this.API, api_overrides);

		this.connection = new Connection(null, this.view_meta);

		this.connection.onMessage = frame => {
			try {
				const [method, ...args] = frame;

				this.API[method](...args);
			} catch (e) {
				// socket.close();
				console.error(e);
				console.log(frame);
			}
		};

		// in competitions layout, we typically show score diff, tetris diff, but also runway and projection diffs
		// to save processing time, we check what the layout supports
		// i.e. if there's no projection or no runway, no need to sort players on those and display their content
		this.diffSetters = [{ getter: 'getScore', setter: 'setDiff' }];

		if (_players[0]?.dom.runway_diff !== DOM_DEV_NULL) {
			this.diffSetters.push({
				getter: 'getGameRunwayScore',
				setter: 'setGameRunwayDiff',
			});
		}

		if (_players[0]?.dom.projection_diff !== DOM_DEV_NULL) {
			this.diffSetters.push({
				getter: 'getProjection',
				setter: 'setProjectionDiff',
			});
		}

		// if video is enabled for the layout, we need to set up the layput to do the handshake
		if (
			this.has_video &&
			Peer &&
			_players[0] &&
			_players[0].dom.video !== DOM_DEV_NULL
		) {
			this.is_secondary = false;
			this.peer = null;

			this.API.setSecondary = () => {
				this.is_secondary = true;

				if (this.peer) {
					this.peer.destroy();
					this.peer = null;
				}
			};

			this.connection.onInit = () => {
				if (this.is_secondary) return;

				if (this.peer) {
					this.peer.destroy();
					this.peer = null;
				}

				this.peer = new Peer(this.connection.id, peerServerOptions);

				this.peer.on('call', call => {
					if (this.is_secondary) return;

					console.log(`Received media call from ${call.peer}`);

					if (!this.getPlayersByPeerId(call.peer).length) return;

					call.on('stream', remoteStream => {
						this.getPlayersByPeerId(call.peer) // rechecking because async!
							.forEach(player => {
								const video = player.dom.video;

								video.srcObject = remoteStream;
								video.addEventListener(
									'loadedmetadata',
									() => {
										video.play();
									},
									{
										once: true,
									}
								);
							});
					});

					call.answer();
				});
			};
		} else {
			_players.forEach(player => {
				player.dom.video.style.display = 'none';
			});
		}
	}

	computeScoreDifferentials(_players) {
		if (!_players) _players = this.players;

		const winner_slice_ratio = 1 / (_players.length - 1);

		// score change, we need to update all the diffs
		this.diffSetters.forEach(({ getter, setter }) => {
			const sorted_players = getSortedPlayers(_players, getter);

			// handle score diff between player 0 and 1
			const diff = sorted_players[0][getter]() - sorted_players[1][getter]();

			if (!isNaN(diff)) {
				const t_diff = getTetrisDiff(
					sorted_players[0],
					sorted_players[1],
					getter
				);

				sorted_players[0][setter](diff, t_diff, 0);
				sorted_players[1][setter](-diff, -t_diff, winner_slice_ratio);
			}

			for (let pidx = 2; pidx < sorted_players.length; pidx++) {
				const leader = sorted_players[pidx - 1];
				const laggard = sorted_players[pidx];

				const diff = leader[getter]() - laggard[getter]();

				if (isNaN(diff)) continue;

				const t_diff = getTetrisDiff(leader, laggard, getter);

				laggard[setter](-diff, -t_diff, pidx * winner_slice_ratio);
			}
		});
	}

	_onPlayerScoreChanged() {
		this.computeScoreDifferentials();
	}

	getPlayerIndexByPeerId(peerid) {
		return this.players.findIndex(player => player.peerid === peerid);
	}

	getPlayersByPeerId(peerid) {
		return this.players.filter(player => player.peerid === peerid);
	}
}
