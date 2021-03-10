// very simple RPC system to allow server to send data to client

function getPlayer(idx) {
	return players[idx];
}

function getOtherPlayer(idx) {
	return players[(idx+1) % 2];
}

function tetris_value(level) {
	return 1200 * (level + 1);
}

function getTetrisDiff(p1, p2, use_pace_score) {
	const p1_score = use_pace_score ? p1.pace_score : p1.score;
	const p2_score = use_pace_score ? p2.pace_score : p2.score;

	let lines, level;

	if (p1_score > p2_score) {
		level = p2.level;
		lines = p2.lines;
	}
	else if (p2_score > p1_score) {
		level = p1.level;
		lines = p1.lines;
	}
	else {
		return 0;
	}

	let tetrises = 0
	let diff = abs(p1_score - p2_score)

	while (diff > 0) {
		if (lines >= 126) { // below 126 lines, level doesn't change every 10 lines
			if (lines % 10 >= 6) { // the tetris is counted at end level, not start level
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
		getPlayer(player_idx).playWinnerAnimation();
		getOtherPlayer(player_idx).showLoserFrame();
	}

	_repaintVictories(player_idx) {
		const player = getPlayer(player_idx);
		const victories = this.victories[player_idx]

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

			hearts
				[player.render_wins_rtl ? 'prepend' : 'appendChild']
				(heart);
		}
	}

	frame(player_idx, data) {
		const
			player      = getPlayer(player_idx),
			otherPlayer = getOtherPlayer(player_idx),
			otherScore  = otherPlayer.getScore();

		player.setFrame(data);

		const score = player.getScore();

		if (isNaN(score) || isNaN(otherScore)) return;

		const diff = score - otherScore;
		const t_diff = getTetrisDiff(player, otherPlayer);

		// TODO: Ideally make t_diff sdame sign as diff for consistency
		player.setDiff(diff, t_diff);
		otherPlayer.setDiff(-diff, t_diff);

		const p_diff = player.getPaceScore() - otherPlayer.getPaceScore();
		const pt_diff = getTetrisDiff(player, otherPlayer, true);

		player.setPaceDiff(p_diff, pt_diff);
		otherPlayer.setPaceDiff(-p_diff, pt_diff);
	}
};

const connection = new Connection(4003);

connection.onMessage = function(frame) {
	try{
		const [method, ...args] = frame;

		API[method](...args);
	}
	catch(e) {
		// socket.close();
		console.error(e);
		console.log(frame);
	}
};
