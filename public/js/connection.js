
const RETRY_DELAY_BASE = 2500;
const RETRY_DELAY_MAX = 10 * 60 * 1000; // 10 mins
const RETRY_DELAY_VARIANCE = 0.1; // Makes retry random at +- variance

class Connection {
	constructor(url) {

		const wsp = location.protocol.match(/^https/i) ? 'wss' : 'ws';

		if (url) {
			if (/^wss?:\/\//.test(url)) {
				this.url = url;
			}
			else {
				this.url = `${wsp}://${url}`;
			}
		}
		else {
			this.url = `${wsp}://${location.host}/ws${location.pathname}`;
		}

		this.connect        = this.connect.bind(this);
		this._handleOpen    = this._handleOpen.bind(this);
		this._handleError   = this._handleError.bind(this);
		this._handleClose   = this._handleClose.bind(this);
		this._handleMessage = this._handleMessage.bind(this);

		this.connect();

		this.conn_retries = 0;
	}

	onConnected() {}
	onMessage() {}

	_getReconnectionDelay() {
		const variance = (1 - RETRY_DELAY_VARIANCE) + RETRY_DELAY_VARIANCE * 2 * Math.random();

		return Math.floor(
			BASE_RETRY_DELAY * Math.pow(2, this.conn_retries++) * variance
		);
	}

	_handleOpen() {
		this.conn_retries = 0;
	}

	_handleError() {}

	_handleMessage(event) {
		if (typeof event.data === 'string') {
			const data = JSON.parse(event.data);

			if (Array.isArray(data)) {
				// Connection-level command parsing
				switch(data[0]) {
					case '_kick': {
						console.log('Connection: WebSocket kicked', data[1]);
						this.close();
						return;
					}
					case '_connected': { // custom handshake (assume success unless rejected)
						console.log('Connection: WebSocket connected', data[1]);
						this.conn_retries = 0;
						this.onConnected(data[1]);
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
			console.log('Connection: Warning: Unknown message type');
		}
	}

	_handleClose() {
		this._clearSocket();
		this.reconn_to = setTimeout(this.connect, this._getReconnectionDelay());
	}

	_clearSocket() {
		try {
			this.socket.removeEventListener('open', this._handleOpen);
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

		if (this.reconn_to) {
			this.reconn_to = clearTimeout(this.reconn_to);
		}

		this.socket = new WebSocket(this.url);
		this.socket.binaryType = "arraybuffer";
		this.socket.addEventListener('open', this._handleOpen);
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
