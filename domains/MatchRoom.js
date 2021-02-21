const _ = require('lodash');

const Room = require('./Room');


class MatchRoom extends Room {
	constructor() {
		super();

		this.members = new Set();
	}
}

module.exports = MatchRoom;