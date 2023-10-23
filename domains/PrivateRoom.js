import Room from './Room.js';

class PrivateRoom extends Room {
	constructor(owner) {
		super(owner);

		this.last_view_peer_id = null;
		this.last_view_meta = null;
	}

	addView(connection) {
		super.addView(connection);

		// send some standard info
		connection.send(['setId', 0, this.owner.id]);
		connection.send(['setLogin', 0, this.owner.login]);
		connection.send(['setDisplayName', 0, this.owner.display_name]);
		connection.send(['setCountryCode', 0, this.owner.country_code]);
		connection.send(['setProfileImageURL', 0, this.owner.profile_image_url]);

		// last video-enabled view always wins the video feed
		if (connection.meta.video) {
			this.last_view_peer_id = connection.id;
			this.last_view_meta = connection.meta;
			this.owner.makePlayer();
		}
	}

	removeView(connection) {
		super.removeView(connection);

		if (connection.id === this.last_view_peer_id) {
			this.last_view_peer_id = null;
			this.last_view_meta = null;
			this.owner.makePlayer();
		}
	}
}

export default PrivateRoom;
