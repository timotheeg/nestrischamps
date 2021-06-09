const BinaryFrame = require('../public/js/BinaryFrame');
const ScoreDAO = require('../daos/ScoreDAO');
const got = require('got');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');

class Replay {
	constructor(connection, player_num, game_id_or_url, time_scale = 1) {
		this.connection = connection;
		this.player_num = player_num;
		this.game_id_or_url = game_id_or_url;
		this.time_scale = time_scale;
		this.frame_buffer = [];

		this.startStreaming();
	}

	async startStreaming() {
		if (typeof this.game_id_or_url === 'string') {
			if (this.game_id_or_url.startsWith('http')) {
				const game_url = this.game_id_or_url;
				this.game_stream = got.stream(game_url);
			} else {
				console.log(`Replay Error: Invalid Game URL: this.game_id_or_url`);
				return;
			}
		} else {
			const game_id = this.game_id_or_url;
			const score_data = await ScoreDAO.getAnonymousScore(game_id);
			const file_path = score_data.frame_file;

			if (!file_path) {
				console.log(
					`Replay Error: No replay file found for gameid ${game_id}:`,
					score_data
				);
				return;
			}

			if (process.env.GAME_FRAMES_BUCKET) {
				// data comes from S3
				//https://nestrischamps.s3-us-west-1.amazonaws.com/
				const base_url = `https://${process.env.GAME_FRAMES_BUCKET}.s3-${process.env.GAME_FRAMES_REGION}.amazonaws.com/`;

				this.game_stream = got.stream(`${base_url}${file_path}`);
			} else {
				// data comes from local file
				this.game_stream = fs
					.createReadStream(path.join(__dirname, '..', file_path))
					.pipe(zlib.createGunzip());
			}
		}

		this.game_stream.on('readable', () => {
			/* eslint-disable no-constant-condition */
			do {
				const buf = this.game_stream.read(71);

				if (buf === null) {
					return; // done!!
				}

				// Hardcoding 71 as frame size of the binary format
				// Note that the format version might imply different frame length
				// Ideally, on first data read, we'd check the header, check the version, and extract the frame size
				// and then use that frame size for all subsequent reads
				if (buf.length < 71) {
					this.game_stream.unshift(buf);
					break;
				}

				if (!this.start_time) {
					// Parsing the frame may not be needed just to get ctime
					// but we should also check the version format

					const data = BinaryFrame.parse(buf);

					this.start_time = Date.now();
					this.start_ctime = data.ctime;
				}

				this.frame_buffer.push(buf);

				this.sendNextFrame();
			} while (true);

			this.game_stream.read(0);
		});

		// TODO: Error handling close hand,ing on source and target, etc...
	}

	sendNextFrame() {
		if (this.send_timeout) return;
		if (this.frame_buffer.length <= 0) return;

		const frame = new Uint8Array(this.frame_buffer.shift());

		frame[0] = (frame[0] & 0b11111000) | this.player_num;

		const tdiff = Math.round(
			(BinaryFrame.getCTime(frame) - this.start_ctime) / this.time_scale
		);
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
