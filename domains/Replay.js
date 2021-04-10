const BinaryFrame = require('../public/js/BinaryFrame');
const ScoreDAO = require('../daos/ScoreDAO');
const got = require('got');


class Replay {
	constructor(connection, player_num, game_id_or_url, time_scale = 1) {
		this.connection = connection;
		this.player_num = player_num;
		this.game_id_or_url = game_id_or_url;
		this.time_scale = time_scale;
		this.frame_buffer = [];
		this.done = false;

		this.startStreaming();
	}

	async startStreaming() {
		let game_url;

		if (typeof this.game_id_or_url === 'string') {
			if (this.game_id_or_url.startsWith('http')) {
				game_url = this.game_id_or_url;
			}
			else {
				throw new Exception('Invaid Game URL');
			}
		}
		else {
			const path = await ScoreDAO.getAnonymousScore().frame_file;

			game_url = `${process.env.GAME_FRAMES_BASEURL}${path}`;
		}

		this.game_stream = got.stream(game_url);

		this.game_stream.on('readable', () => {
			do {
				const buf = this.game_stream.read(71);

				if (buf === null) {
					return; // done!!
				}

				if (buf.length < 71) {
					this.game_stream.unshift(buf);
					break;
				}

				if (!this.start_time) {
					const data = BinaryFrame.parse(buf);

					this.start_time = Date.now();
					this.start_ctime = data.ctime;
				}

				this.frame_buffer.push(buf);

				this.sendNextFrame();
			}
			while(true);

			this.game_stream.read(0);
		});

		// TODO: Error handling close hand,ing on source and target, etc...
	}

	sendNextFrame() {
		if (this.send_timeout) return;
		if (this.frame_buffer.length <= 0) return;

		const frame = new Uint8Array(this.frame_buffer.shift());

		frame[0] = (frame[0] & 0b11111000) | this.player_num;

		const tdiff = Math.round((BinaryFrame.getCTime(frame) - this.start_ctime) / this.time_scale);
		const frame_tick = this.start_time + tdiff;
		const now = Date.now();

		const send_delay = Math.max(0, frame_tick - now);

		this.send_timeout = setTimeout(() => {
			this.send_timeout = null;
			this.connection.send(frame);
			this.sendNextFrame();
		}, send_delay);
	}
}

module.exports = Replay;