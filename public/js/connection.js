import BinaryFrame from '/js/BinaryFrame.js';

export default class Connection {
	constructor(uri = null, extra_search_params = null) {
		let url;

		if (uri) {
			url = new URL(uri); // may throw
		} else {
			url = new URL(location);

			// match current page prototol (secure / insecure)
			url.protocol = url.protocol.match(/^https/i) ? 'wss:' : 'ws:';
			url.pathname = `/ws${url.pathname}`;
		}

		if (extra_search_params) {
			extra_search_params.forEach((value, key) => {
				if (!key.startsWith('_')) key = `_${key}`;
				url.searchParams.set(key, value);
			});
		}

		this.uri = url.toString();

		this.broken = false;

		this.connect = this.connect.bind(this);
		this._handleOpen = this._handleOpen.bind(this);
		this._handleError = this._handleError.bind(this);
		this._handleClose = this._handleClose.bind(this);
		this._handleMessage = this._handleMessage.bind(this);

		this.connect();
	}

	onOpen() {}
	onInit() {}
	onBreak() {}
	onResume() {}
	onKicked() {}
	onMessage() {}

	_handleOpen() {
		if (this.broken) {
			this.broken = false;
			this.onResume();
		} else {
			this.onOpen();
		}
	}

	_handleError(err) {
		// console.error(err);
	}

	_handleMessage(event) {
		if (typeof event.data === 'string') {
			const data = JSON.parse(event.data);

			if (Array.isArray(data)) {
				// Connection-level command parsing
				switch (data[0]) {
					case '_init': {
						this.id = data[1].id;
						this.start_ts = data[1].server_ts;
						this.id_ts = Date.now();
						this.onInit();
						return;
					}
					case '_kick': {
						const reason = data[1];
						console.log('Socket kicked', reason);
						this.close();
						this.onKicked(reason);
						return;
					}
				}
			}

			this.onMessage(data);
		} else if (event.data instanceof ArrayBuffer) {
			const frame = BinaryFrame.parse(event.data);
			this.onMessage(['frame', frame.player_num, frame]);
		} else {
			console.log('Unknown message type');
		}
	}

	_handleClose() {
		this._clearSocket();
		this.broken = true;
		this.onBreak();
		setTimeout(this.connect, 5000); // TODO: exponential backoff
	}

	_clearSocket() {
		try {
			this.socket.removeEventListener('open', this._handleOpen);
			this.socket.removeEventListener('error', this._handleError);
			this.socket.removeEventListener('close', this._handleClose);
			this.socket.removeEventListener('message', this._handleMessage);
			this.socket.close();
			this.socket = null;
		} catch (e) {}
	}

	connect() {
		if (this.socket) {
			this._clearSocket();
		}

		this.socket = new WebSocket(this.uri);

		this.socket.binaryType = 'arraybuffer';

		this.socket.addEventListener('open', this._handleOpen);
		this.socket.addEventListener('error', this._handleError);
		this.socket.addEventListener('close', this._handleClose);
		this.socket.addEventListener('message', this._handleMessage);
	}

	close() {
		this._clearSocket();

		delete this.onBreak;
		delete this.onResume;
		delete this.onKicked;
		delete this.onMessage;
	}

	send(data) {
		if (!this.socket || this.socket.readyState !== 1) {
			// 1 === OPEN
			return;
		}

		try {
			if (data instanceof Uint8Array) {
				this.socket.send(data); // send binary frame
			} else {
				this.socket.send(JSON.stringify(data));
			}
		} catch (err) {}
	}
}
