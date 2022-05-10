function noop() {}

export default class FrameBuffer {
	constructor(duration_ms = 0, frame_callback = noop) {
		this.duration_ms = duration_ms;
		this.frame_callback = frame_callback;
		this.buffer = [];

		this.frame_to = null;

		this._sendFrame = this._sendFrame.bind(this);
	}

	setFrame(frame) {
		if (this.duration_ms <= 0) {
			this.frame_callback(frame);
			return;
		}

		this.buffer.push(frame);

		if (this.buffer.length == 1) {
			this._reset();
		}
	}

	_reset() {
		if (this.buffer.length <= 0) return;

		this.client_time_base = 0;
		this.local_time_base = 0;
		this.frame_to = setTimeout(this._sendFrame, this.duration_ms);
	}

	_sendFrame() {
		if (this.buffer.length <= 0) return;

		const data = this.buffer.shift();
		const now = Date.now();

		// record client-local time equivalence
		if (!this.client_time_base) {
			this.client_time_base = data.ctime;
			this.local_time_base = now;
		}

		// send current frame
		this.frame_callback(data);

		// schedule next frame if needed
		if (this.buffer.length) {
			const next_frame_ctime = this.buffer[0].ctime;
			const elapsed = next_frame_ctime - this.client_time_base;

			this.frame_to = setTimeout(
				this._sendFrame,
				this.local_time_base + elapsed - now
			);
		}
	}

	_destroy() {
		this.frame_to = clearTimeout(this.frame_to);
		this.local_time_base = 0;
		this.client_time_base = 0;
		this.buffer.length = 0;
	}
}
