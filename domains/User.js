const PrivateRoom = require('./PrivateRoom');
const MatchRoom = require('./MatchRoom');

class User {
	constructor(user_object) {
		this.id = user_object.id;
		this.login = user_object.login;
		this.secret = user_object.secret;
		this.email = user_object.email;

		this.display_name = user_object.display_name;
		this.description = user_object.description;
		this.profile_image_url = user_object.profile_image_url;

		// TODO: create rooms lazily
		this.private_room = new PrivateRoom();
		this.match_room = new MatchRoom();
	}
}

module.exports = User;