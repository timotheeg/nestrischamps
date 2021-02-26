// very simple RPC system to allow server to send data to client

function getPlayer(num) {
	return players[num - 1];
}

function getOtherPlayer(num) {
	return players[num % 2];
}

class TetrisCompetitionAPI {
	constructor() {
		this.first_to = 3; // defaults to Best of 5

		this.resetVictories();
	}

	resetVictories() {
		this.victories = {1:0, 2:0};

		this._repaintVictories(1);
		this._repaintVictories(2);
	}

	setId(player_num, id) {
		getPlayer(player_num).setId(id);
	}

	setName(player_num, name) {
		getPlayer(player_num).setName(name);
	}

	setAvatar(player_num, avatar_url) {
		getPlayer(player_num).setAvatar(avatar_url);
	}

	// Twitch like command aliases
	setProfileImageURL(payer_num, avatar_url) {
		this.setAvatar(payer_num, avatar_url);
	}

	setDisplayName(player_num, name) {
		this.setName(player_num, name);
	}

	setFirstTo(num_games_to_win) {
		this.first_to = num_games_to_win;

		this.setVictories(1, this.victories[1]);
		this.setVictories(2, this.victories[2]);

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

	setVictories(player_num, num_victories) {
		this.victories[player_num] = num_victories;

		this._repaintVictories(player_num);

		if (num_victories >= this.first_to) {
			// global game winner
			getPlayer(player_num).playWinnerAnimation();
			getOtherPlayer(player_num).showLoserFrame();
		}
	}

	winner(player_num) {
		this.setVictories(player_num, this.victories[player_num] + 1);
	}

	_repaintVictories(player_num) {
		const player = getPlayer(player_num);
		const victories = this.victories[player_num]

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

	frame(player_num, data) {
		const
			index       = player_num,
			player      = players[index],
			otherPlayer = players[(index+1) % 2],
			otherScore  = otherPlayer.getScore();

		player.setFrame(data);

		const score = player.getScore();

		if (isNaN(score) || isNaN(otherScore)) return;

		const diff  = score - otherScore;

		player.setDiff(diff);
		otherPlayer.setDiff(-diff);
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
	}
}
