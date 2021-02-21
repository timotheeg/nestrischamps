class Connection {
	constructor(port, host='127.0.0.1') {
		this.port = port;
		this.host = host;

		this.connect        = this.connect.bind(this);
		this._handleError   = this._handleError.bind(this);
		this._handleClose   = this._handleClose.bind(this);
		this._handleMessage = this._handleMessage.bind(this);

		this.connect();
	}

	onMessage() {}

	_handleError() {}

	_handleMessage(event) {
		this.onMessage(JSON.parse(event.data));
	}

	_handleClose() {
		this._clearSocket();
		setTimeout(this.connect, 25);
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

		this.socket = new WebSocket(`ws://${this.host}:${this.port}`);

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
			this.socket.send(JSON.stringify(data));
		}
		catch(err) {}
	}
}
