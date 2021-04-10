const ScoreDAO = require('../daos/ScoreDAO');
const got = require('got');


class Replay {
	constructor(connection, player_num, game_id_or_url) {
		this.connection = connection;
		this.player_num = player_num;
		this.game_id_or_url = game_id_or_url;
		this.frame_buffer = [];

		this.startStreaming();
	}

	async startStreaming() {
		let game_url;

		if (typeof this.game_id_or_url === 'string') {
			if (this.game_id_or_url.startsWitch('http')) {
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
				const buf = ins.read(71);

				if (buf === null) {
					return; // done!!
				}

				if (buf.length < 71) {
					ins.unshift(buf);
					break;
				}

				if (!this.start_time) {
					const data = BinaryFrame.parse(buf);

					this.start_time = Date.now();
					this.start_ctime = data.ctime;
				}

				this.frames.push(buf);

				this.sendNextFrame();
			}
			while(true);

			ins.read(0);
		});

		// TODO: Error handling close hand,ing on source and target, etc...
	}

	sendNextFrame() {
		if (this.send_timeout) return;
		if (frames.length <= 0) return;

		const frame = new Uint8Array(frames.shift());

		frame[0] = (frame[0] & 0b11111000) | this.player_num;

		const tdiff = BinaryFrame.getCTime(frame) - this.start_ctime;
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