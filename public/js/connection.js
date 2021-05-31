class Connection {
	constructor(uri=null) {
		if (uri) {
			this.uri = uri;
		}
		else {
			// match current page prototol (secure / insecure)
			const wsp = location.protocol.match(/^https/i) ? 'wss' : 'ws';

			this.uri = `${wsp}://${location.host}/ws${location.pathname}${location.search}`;
		}

		this.connect        = this.connect.bind(this);
		this._handleError   = this._handleError.bind(this);
		this._handleClose   = this._handleClose.bind(this);
		this._handleMessage = this._handleMessage.bind(this);

		this.connect();
	}

	onInit() {}
	onBreak() {}
	onResume() {}
	onKicked() {}
	onMessage() {}

	_handleError(err) {
		console.error(err);
	}

	_handleMessage(event) {
		if (typeof event.data === 'string') {
			const data = JSON.parse(event.data);

			if (Array.isArray(data)) {
				// Connection-level command parsing
				switch(data[0]) {
					case '_id': {
						this.remoteid = data[1];
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
		}
		else if(event.data instanceof ArrayBuffer) {
			const frame = BinaryFrame.parse(new Uint8Array(event.data));
			this.onMessage(['frame', frame.player_num, frame]);
		}
		else {
			console.log('Unknown message type');
		}
	}

	_handleClose() {
		this._clearSocket();
		this.onBreak();
		setTimeout(this.connect, 5000); // TODO: exponential backoff
	}

	_clearSocket() {
		try {
			this.socket.removeEventListener('error', this._handleError);
			this.socket.removeEventListener('close', this._handleClose);
			this.socket.removeEventListener('message', this._handleMessage);
			this.socket.close();
			this.socket = null;
		}
		catch(e) {}
	}

	connect() {
		if (this.socket) {
			this._clearSocket();
		}

		this.socket = new WebSocket(this.uri);

		this.socket.binaryType = "arraybuffer";

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
		if (!this.socket || this.socket.readyState !== 1) { // 1 === OPEN
			return;
		}

		try {
			if (data instanceof Uint8Array) {
				this.socket.send(data); // send binary frame
			}
			else {
				this.socket.send(JSON.stringify(data));
			}
		}
		catch(err) {}
	}
}
