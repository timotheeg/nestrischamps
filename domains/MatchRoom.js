const _ = require('lodash');

const Room = require('./Room');


class MatchRoom extends Room {
	constructor() {
		super();

		this.members = new Set();
		this.player1 = null;
		this.player2 = null;
	}
}

module.exports = MatchRoom;