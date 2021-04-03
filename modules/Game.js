// Minimum amount of game tracking to do server side to be able to report games
const BinaryFrame = require('../public/js/BinaryFrame');

const PIECES = ['T', 'J', 'Z', 'O', 'S', 'L', 'I'];

class Game {
	constructor() {
		this.frame_count = 0;
		this.data = null;
		this.over = false;
	}

	setFrame(frame) {
		const data = BinaryFrame.parse(frame);

		if (!this.data) {
			// game initialization frame

			this.gameid = data.gameid;
			this.start_ts = Date.now();
			this.start_level = data.level;

			this.num_pieces = 0;
			this.prior_preview = null;

			this.tetris_lines = 0;

			this.cur_drought = 0;
			this.max_drought = 0;
			this.num_droughts = 0;

			this.das_total = 0;

			this.transition = null;
			this.pieces = [];
			this.clears = [];

			this.pending_score = false;
			this.pending_piece = true;

			this.data = data; // record frame as current state

			return;
		}

		this.frame_count++;

		if (data.gameid != this.gameid) {
			// Note: this test could be done without parsing the whole message!
			this.onNewGame(frame);
			return;
		}
		else if (this.over) {
			return;
		}

		if (this.pending_score) {
			this.pending_score = false;
			this.onScore(data); // update states
		}
		else if (data.score != this.data.score) {
			this.pending_score = true;
		}

		if (this.pending_piece) {
			this.pending_piece = false;
			this.onPiece(data); // update states
		}
		else {
			if (data.game_type === BinaryFrame.GAME_TYPE.CLASSIC) {
				const num_pieces = this._getNumPieces(data);

				if (num_pieces != this.num_pieces) {
					this.pending_piece = true;
				}
			}
			else {
				// TODO; check field and block count
			}
		}

		// Check board for gameover event
		if (!this.over && data.field.slice(0, 10).every(cell => cell)) {
			// Game Over!
			this.over = true;
			this.end_ts = Date.now();

			if (this.frame_count > 1) {
				this.onGameOver();
			}
		}
	}

	_getNumPieces(data) {
		return PIECES.reduce((acc, p) => acc + (data[p] || 0), 0);
	}

	onScore(data) {
		this.data.score = data.score;

		const cleared = data.lines - this.data.lines;

		// when score changes, lines may have changed
		if (cleared) {
			this.data.lines = data.lines;

			this.clears.push(cleared);

			if (cleared === 4) {
				this.tetris_lines += cleared;
			}

			// when line changes, level may have changed
			if (data.level != this.data.level) {
				if (this.transition === null) {
					this.transition = data.score;
				}
				this.data.level = data.level;
			}
		}
	}

	onPiece(data) {
		let cur_piece;

		if (data.game_type === BinaryFrame.GAME_TYPE.CLASSIC) {
			if (this.num_pieces === 0) {
				cur_piece = PIECES.find(p => data[p]); // first truthy value is piece
			}
			else {
				cur_piece = this.prior_preview; // should be in sync 🤞
			}

			// record new state
			this.num_pieces = this._getNumPieces(data);
			PIECES.forEach(p => this.data[p] = data[p]);
			this.prior_preview = data.preview;
		}
		else {
			cur_piece = data.cur_piece; // 💪
			this.das_total = data.cur_piece_das;
		}

		this.pieces.push(cur_piece);

		if (cur_piece == 'I') {
			if (this.cur_drought > this.max_drought) {
				this.max_drought = this.cur_drought;
			}

			this.cur_drought = 0;
		}
		else {
			if (++this.cur_drought === 13) {
				this.num_droughts += 1;
			}
		}
	}

	getReport() {
		let tetris_rate = null;
		let das_avg = -1;

		if (this.clears.length) {
			tetris_rate = this.tetris_lines / this.clears.length;
		}

		if (this.pieces.length && this.das_total) {
			das_avg = this.das_total / this.pieces.length;
		}

		return {
			start_level:  this.start_level,
			end_level:    this.data.level,
			score:        this.data.score,
			lines:        this.data.lines,
			num_droughts: this.num_droughts,
			max_drought:  this.max_drought,
			duration:     (this.end_ts || Date.now()) - this.start_ts,
			transition:   this.transition,
			clears:       this.clears.join(''),
			pieces:       this.pieces.join(''),

			tetris_rate,
			das_avg,
		};
	}

	// client app to overwrite
	onGameOver() {}
	onNewGame() {}
}

module.exports = Game;