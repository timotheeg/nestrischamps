class Connection {
	constructor() {
		this.connect        = this.connect.bind(this);
		this._handleError   = this._handleError.bind(this);
		this._handleClose   = this._handleClose.bind(this);
		this._handleMessage = this._handleMessage.bind(this);

		this.connect();
	}

	onMessage() {}

	_handleError() {}

	_handleMessage(event) {
		if (typeof event.data === 'string') {
			const data = JSON.parse(event.data);

			if (Array.isArray(data)) {
				// Connection-level command parsing
				switch(data[0]) {
					case '_kick': {
						console.log('Socket kicked', data[1]);
						this.close();
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

		// match current page prototol
		const wsp = location.protocol.match(/^https/i) ? 'wss' : 'ws';

		this.socket = new WebSocket(`${wsp}://${location.host}/ws${location.pathname}`);

		this.socket.binaryType = "arraybuffer";
		this.socket.addEventListener('error', this._handleError);
		this.socket.addEventListener('close', this._handleClose);
		this.socket.addEventListener('message', this._handleMessage);
	}

	close() {
		this._clearSocket();
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
