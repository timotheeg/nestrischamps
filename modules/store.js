class Store {
	constructor() {
		this.private_rooms = new Map();
		this.match_rooms = new Map();
		this.users = new Map();
	}
}

const stores = {};

module.exports = function getStore(id) {
	if (!id) id = 'default';

	if (!store[id]) {
		stores[id] = new Store();
	}

	return stores[id];
}




const store = require('./modules/store')();