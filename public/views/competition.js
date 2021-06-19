// very simple RPC system to allow server to send data to client

function getPlayer(idx) {
	return players[idx];
}

function getPlayerIndexByPeerId(peerid) {
	return players.findIndex(player => player.peerid === peerid);
}

function tetris_value(level) {
	return 1200 * (level + 1);
}

function getSortedPlayers(getter = 'getScore') {
	return players.concat().sort((p1, p2) => {
		const p1_score = p1[getter]();
		const p2_score = p2[getter]();

		if (isNaN(p1_score)) return -1;
		if (isNaN(p2_score)) return 1;

		return p2_score - p1_score;
	});
}

function getTetrisDiff(leader, laggard, getter = 'getScore') {
	const leader_score = leader[getter]();
	const laggard_score = laggard[getter]();

	if (leader_score === laggard_score) return 0;

	const transition = TRANSITIONS[laggard.start_level];

	let level = laggard.level;
	let lines = laggard.lines;
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

		this.resetVictories();
	}

	resetVictories() {
		this.victories = [0, 0];

		this._repaintVictories(0);
		this._repaintVictories(1);

		players.forEach(player => player.clearField());
	}

	setId(player_idx, id) {
		getPlayer(player_idx).setId(id);
	}

	setPeerId(player_idx, peerid) {
		getPlayer(player_idx).setPeerId(peerid);
	}

	setSecondaryView() {
		// overload as needed
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

	setFirstTo(num_games_to_win) {
		this.first_to = num_games_to_win;

		this.setVictories(0, this.victories[0]);
		this.setVictories(1, this.victories[1]);

		/*
		if (this.victories[1] < this.first_to && this.victories[2] < this.first_to) {
			getPlayer(1).clearField();
			getPlayer(2).clearField();
		}
		/**/
	}

	setBestOf(num_games) {
		this.setFirstTo(Math.ceil(num_games / 2));
	}

	setVictories(player_idx, num_victories) {
		this.victories[player_idx] = num_victories;

		this._repaintVictories(player_idx);
	}

	setWinner(player_idx) {
		players.forEach((player, pidx) => {
			if (pidx === player_idx) {
				player.playWinnerAnimation();
			} else {
				player.showLoserFrame();
			}
		});
	}

	_repaintVictories(player_idx) {
		const player = getPlayer(player_idx);
		const victories = this.victories[player_idx];

		const hearts = player.dom.hearts;

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
		const old_score = player.getScore();
		const old_runway = player.getGameRunwayScore();

		player.setFrame(data);

		const new_score = player.getScore();
		const new_runway = player.getGameRunwayScore();

		if (new_score === old_score && new_runway === old_runway) return;

		const winner_slice_ratio = 1 / (players.length - 1);

		// score change, we need to update all the diffs
		[
			{ getter: 'getScore', setter: 'setDiff' },
			{ getter: 'getGameRunwayScore', setter: 'setGameRunwayDiff' },
			{ getter: 'getProjection', setter: 'setProjectionDiff' },
		].forEach(({ getter, setter }) => {
			const sorted_players = getSortedPlayers(getter);

			// handle score diff between player 0 and 1
			const diff = sorted_players[0][getter]() - sorted_players[1][getter]();

			if (!isNaN(diff)) {
				const t_diff = getTetrisDiff(
					sorted_players[0],
					sorted_players[1],
					getter
				);

				sorted_players[0][setter](diff, t_diff, 0);
				sorted_players[1][setter](diff, t_diff, winner_slice_ratio);
			}

			for (let pidx = 2; pidx < sorted_players.length; pidx++) {
				const leader = sorted_players[pidx - 1];
				const laggard = sorted_players[pidx];

				const diff = leader[getter]() - laggard[getter]();

				if (isNaN(diff)) continue;

				const t_diff = getTetrisDiff(leader, laggard, getter);

				laggard[setter](diff, t_diff, pidx * winner_slice_ratio);
			}
		});
	}

	setSecondaryView() {
		// TODO: the player video streams will end, should clear the view
	}
}

let connection;

try {
	connection = new Connection(null, view_meta); // sort of gross T_T
} catch (_err) {
	connection = new Connection();
}

connection.onMessage = function (frame) {
	try {
		const [method, ...args] = frame;

		API[method](...args);
	} catch (e) {
		// socket.close();
		console.error(e);
		console.log(frame);
	}
};
