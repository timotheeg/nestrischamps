// Minimum amount of game tracking to do server side to be able to report games
const BinaryFrame = require('../public/js/BinaryFrame');

const PIECES = ['T', 'J', 'Z', 'O', 'S', 'L', 'I'];

const LINE_CLEAR_IGNORE_FRAMES = 7;


class Game {
	constructor() {
		this.frame_count = 0;
		this.data = null;
		this.over = false;
	}

	setFrame(frame) {
		const data = BinaryFrame.parse(frame);

		if (this.score === null || this.lines === null || this.level === null) {
			// not in game
			return;
		}

		this.frame_count++;

		if (!this.data) {
			// Game initialization frame
			// Assume good timing and record initial state from it as-is

			this.IS_CLASSIC_ROM = data.game_type === BinaryFrame.GAME_TYPE.CLASSIC;

			this.gameid = data.gameid;
			this.start_ts = Date.now();
			this.start_level = data.level;

			this.num_blocks = this._getNumBlocks(data); // assume correct...
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

			this.clear_animation_remaining_frames = 0;

			this.data = data; // record frame as current state

			return;
		}

		if (data.gameid != this.gameid) {
			if (!this.over) {
				this._doGameOver();
			}

			this.onNewGame(frame);
			return;
		}
		else if (this.over) {
			return;
		}

		if (this.pending_score) {
			this.pending_score = false;
			this.onScore(data); // updates state
		}
		else if (data.score != this.data.score) {
			this.pending_score = true;
		}

		if (this.pending_piece) {
			this.pending_piece = false;
			this.onPiece(data); // updates state
		}
		else {
			if (this.IS_CLASSIC_ROM) {
				const num_pieces = this._getNumPieces(data);

				if (num_pieces != this.num_pieces) {
					this.pending_piece = true;
				}
			}
			else {
				do {
					if (this._isSameField(data)) break;

					if (this.clear_animation_remaining_frames-- > 0) break;

					const cur_num_blocks = this._getNumBlocks(data);
					const block_diff = cur_num_blocks - this.num_blocks;

					switch(block_diff) {
						case 4:
							this.data.field = data.field;
							this.num_blocks = cur_num_blocks;
							this.pending_piece = true;
							break;

						case -8:
							this.onTetris();
						case -6:
							this.clear_animation_remaining_frames = LINE_CLEAR_IGNORE_FRAMES - 1;
							this.num_blocks += (block_diff * 5); // equivalent to fast forward on how many blocks will have gone after the animation
							break;

						case -4:
							if (this.pending_single) {
								this.clear_animation_remaining_frames = LINE_CLEAR_IGNORE_FRAMES - 2;
								this.num_blocks -= 10;
							}
							else {
								this.clear_animation_remaining_frames = LINE_CLEAR_IGNORE_FRAMES - 1;
								this.num_blocks -= 20;
							}

							this.pending_single = false;
							break;

						case -2:
							// -2 can happen on the first clear animation frame of a single
							// -2 can also happen when the piece is at the top of the field and gets rotated and is then partially off field
							// to differentiate the 2, we must wait for the next frame, if it goes to -4, then it is the clear animation continuing
							this.pending_single = true;
							break;

						default:
							// We ignore invalid block count diffs. In many cases these dut to interlace artefacts when the pieces rotate of move
							// TODO: block count tracking can fall out of sync, breaking piece count events. CCan anything be done to restore a "clean" count and resume
							this.pending_single = false;
					}

				}
				while(false);
			}
		}

		// Check board for gameover event
		if (!this.over && data.field.slice(0, 10).every(cell => cell)) {
			this._doGameOver();
		}
	}

	_doGameOver() {
		this.over = true;
		this.end_ts = Date.now();

		if (this.frame_count > 2) {
			this.onGameOver();
		}
	}

	_isSameField(data) {
		return data.field.every((cell, idx) => cell === this.data.field[idx]);
	}

	_getNumBlocks(data) {
		return data.field.reduce((acc, cell) => acc + (cell ? 1 : 0), 0);
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
				this.data.level = data.level;

				if (this.transition === null) {
					this.transition = data.score;
				}
			}
		}
	}

	onPiece(data) {
		let cur_piece;

		if (this.IS_CLASSIC_ROM) {
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
	onTetris() {}
	onGameOver() {}
	onNewGame() {}
}

module.exports = Game;