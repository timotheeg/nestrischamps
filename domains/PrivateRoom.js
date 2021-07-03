const Room = require('./Room');

class PrivateRoom extends Room {
	constructor(owner) {
		super(owner);

		this.last_view_peer_id = null;
		this.last_view_meta = null;
	}

	addView(connection) {
		super.addView(connection);

		// last video-enabled view always wins the video feed
		if (connection.meta.video) {
			this.last_view_peer_id = connection.id;
			this.last_view_meta = connection.meta;

			this.makePlayer();
		}
	}

	removeView(connection) {
		super.removeView(connection);

		if (connection.id === this.last_view_peer_id) {
			this.last_view_peer_id = null;
			this.last_view_meta = null;
			this.makePlayer();
		}
	}

	makePlayer() {
		this.owner.getProducer().send(['setViewPeerId', this.last_view_peer_id]);
		this.owner.getProducer().send(['makePlayer', 0, this.last_view_meta]);
	}
}

module.exports = PrivateRoom;
