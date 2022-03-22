// Minimum amount of game tracking to do server side to be able to report games
import ArrayView from './ArrayView.js';
import Board from '/views/Board.js';
import peek from '/views/utils.js';
import {
	PIECES,
	DROUGHT_PANIC_THRESHOLD,
	SCORE_BASES,
	DAS_THRESHOLDS,
	RUNWAY,
	TRANSITIONS,
	EFF_LINE_VALUES,
	getRunway,
} from '/views/constants.js';

const LINE_CLEAR_IGNORE_FRAMES = 7;

const ALL_POSSIBLE_NEGATIVE_DIFFS = [
	-2, -4, -6, -8, -10, -12, -16, -18, -20, -24, -30, -32, -40,
];

const CLEAR_DIFFS = [
	[-2, -4, -6, -8, -10],
	[-4, -8, -12, -16, -20],
	[-6, -12, -18, -24, -30],
	[-8, -16, -24, -32, -40],
];

const CLEAR_TYPES = [1, 2, 3, 4];
const POINT_TYPES = [...CLEAR_TYPES, 'drops'];

function fuzzyBinarySearchWithLowerBias(array, prop, target_value) {
	const last_entry = peek(array);

	// one check for last frame first
	if (last_entry[prop] <= target_value) {
		return [array.length - 1, last_entry];
	}

	let left = 0;
	let right = array.length - 1;
	let mid;

	while (left <= right) {
		mid = Math.round((left + right) / 2);

		if (mid === left) break;

		const value = array[mid][prop];

		if (value === target_value) break;

		if (value < target_value) {
			left = mid; // mid could still be the desired entry, so we do NOT apply the usual + 1
		} else {
			right = mid - 1; // mid CANNOT be the desired entry, so we apply the usual - 1
		}
	}

	return [mid, array[mid]];
}

class PieceData {
	constructor() {}
}

class PointData {
	constructor() {}
}

export default class BaseGame {
	constructor(event) {
		this.start_ts = 0;
		this.data = null;
		this.over = false;
		this.num_frames = 0;

		this.frames = [];
		this.pieces = [];
		this.points = [];
		this.clears = [];
	}

	end() {
		if (!this.over) {
			this._doGameOver();
		}
	}

	setFrame(frame) {
		const data = BinaryFrame.parse(frame);

		if (data.score === null || data.lines === null || data.level === null) {
			// not in game
			return;
		}

		if (!this.data) {
			// Game initialization frame - Assume good
			this._doStartGame(data);
			return;
		}

		if (data.gameid != this.gameid) {
			this.end();
			this.onNewGame(frame);
			return;
		}

		if (this.over) {
			return;
		}

		this._addFrame(frame);

		const cur_num_blocks = this._getNumBlocks(data);

		if (this.pending_score) {
			this.pending_score = false;
			this._doScore(data); // updates state
		} else {
			if (data.score === 999999) {
				this.pending_score = data.lines != this.data.lines;
			} else {
				const high_score = this.data.score / 1600000;

				if (high_score >= 1) {
					this.pending_score = data.score != this.data.score % 1600000;
				} else {
					this.pending_score = data.score != this.data.score;
				}
			}
		}

		if (this.pending_piece) {
			this.pending_piece = false;
			this._doPiece(data);
		} else {
			if (this.is_classic_rom) {
				const num_pieces = this._getNumPieces(data);

				if (num_pieces != this.num_pieces) {
					this.pending_piece = true;
				}
			} else {
				/* eslint-disable no-constant-condition */

				do {
					if (this._isSameField(data)) break;

					if (this.clear_animation_remaining_frames-- > 0) break;

					const block_diff = cur_num_blocks - this.num_blocks;

					switch (block_diff) {
						/* eslint-disable no-fallthrough */

						case 4:
							this.data.field = data.field;
							this.num_blocks = cur_num_blocks;
							this.pending_piece = true;
							break;

						case -8:
							this.onTetris();
						case -6:
							this.clear_animation_remaining_frames =
								LINE_CLEAR_IGNORE_FRAMES - 1;
							this.num_blocks += block_diff * 5; // equivalent to fast forward on how many blocks will have gone after the animation
							break;

						case -4:
							if (this.pending_single) {
								this.clear_animation_remaining_frames =
									LINE_CLEAR_IGNORE_FRAMES - 2;
								this.num_blocks -= 10;
							} else {
								this.clear_animation_remaining_frames =
									LINE_CLEAR_IGNORE_FRAMES - 1;
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
				} while (false);
			}
		}

		// Check board for gameover event (curtain has fallen)
		if (cur_num_blocks >= 200) {
			this.end();
		}
	}

	_doStartGame(data) {
		this.gameid = data.gameid;
		this.start_ctime = data.ctime;
		this.start_ts = Date.now();
		this.is_classic_rom = data.game_type === BinaryFrame.GAME_TYPE.CLASSIC;

		this.data = {
			start_level: data.level,

			level: data.level,
			burn: 0,

			score: {
				current: data.score,
				runway: data.score + getRunway(data.level, RUNWAY.GAME, data.lines),
				tr_runway: data.score + getRunway(level, RUNWAY.TRANSITION, data.lines),
				normalized: 0,
				transition: null,
			},

			i_droughts: {
				count: 0,
				cur: 0,
				last: 0,
				max: 0,
			},

			das: {
				cur: 0,
				total: 0, // running total, used for average computation
				avg: 0,
				great: 0,
				ok: 0,
				bad: 0,
			},

			pieces: {
				count: 0,
				deviation: 0,
				deviation_28: 0,
				deviation_56: 0,
			},

			lines: {
				count: lines,
			},

			points: {
				drops: {
					count: 0, // "count" is a bad name
					percent: 0,
				},
			},

			num_blocks: this._getNumBlocks(data),
		};

		PIECES.forEach(name => {
			this.data.pieces[name] = {
				count: 0,
				percent: 0,
				drought: 0,
				indexes: [],
			};
		});

		[1, 2, 3, 4].forEach(name => {
			this.data.lines[name] = {
				count: 0,
				lines: 0,
				percent: 0,
			};

			this.data.points[name] = {
				count: 0,
				percent: 0,
			};
		});

		this.array_views = {
			pieces: null,
			points: null,
			clears: null,
			piece_stats: null,
		};

		this.prior_preview = null;
		this.pending_score = false;
		this.pending_piece = true;
		this._addFrame(frame);

		this.onGameStart();
	}

	_doGameOver() {
		if (this.over) return;

		this.over = true;
		this.end_ts = Date.now();
		this.end_ctime = peek(this.frames).ctime;
		this.onGameOver();
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

	_addFrame(data) {
		const frame = {
			...data,
			...this.array_views,
			transition: this.transition,
		};

		this.frames.push(frame);

		this.onValidFrame(frame);
	}

	_doScore(data) {
		const cleared = data.lines - this.data.lines;
		const lines_score = (SCORE_BASES[cleared] || 0) * (data.level + 1);

		let real_score = data.score;

		if (data.score === 999999 && this.data.score + lines_score >= 999999) {
			// Compute score beyond maxout
			real_score = this.data.score + lines_score;
		} else if (data.score < this.data.score) {
			const num_wraps = Math.floor((this.data.score + lines_score) / 1600000);

			if (num_wraps >= 1) {
				// Using Hex score Game Genie code XNEOOGEX
				// The GG code makes the score display wrap around to 0
				// when reaching 1,600,000. We correct accordingly here.
				real_score = 1600000 * num_wraps + data.score;
			} else {
				// weird reading (score goes lower than it was)
				// but we do nothing and will accept it anyway
			}
		}

		const score_increment = real_score - this.data.score;

		this.data.points.drops.count += Math.max(0, score_increment - lines_score);
		this.data.lines.count = data.lines;

		// when score changes, lines may have changed
		if (cleared) {
			if (cleared > 0 && cleared <= 4) {
				this.data.score.normalized += EFF_LINE_VALUES[cleared] * cleared;

				// update lines stats for clearing type (single, double, etc...)
				this.data.lines[cleared].count += 1;
				this.data.lines[cleared].lines += cleared;

				// update points stats for clearing type (single, double, etc...)
				this.data.points[cleared].count += lines_score;

				// update percentages for everyone
				CLEAR_TYPES.forEach(clear_type => {
					const clear_stats = this.data.lines[clear_type];
					clear_stats.percent = clear_stats.lines / data.lines;
				});
			} else {
				console.warn(`Invalid clear: ${cleared} lines`);
			}

			if (cleared === 4) {
				this.tetris_lines += cleared;
				this.data.burn = 0;
			} else {
				this.data.burn += cleared;
			}

			// when line changes, level may have changed
			if (data.level != this.data.level) {
				this.data.level = data.level;

				if (this.transition === null) {
					this.data.score.transition = real_score;
					this.data.score.tr_runway = real_score;
					this.onTransition();
				}

				this.onLevel();
			} else if (this.transition === null) {
				this.data.score.tr_runway =
					real_score +
					getRunway(this.data.start_level, RUNWAY.TRANSITION, data.lines);
			}

			this.onLines();
		}

		// update point percentages for all point types
		POINT_TYPES.forEach(point_type => {
			const point_stats = this.data.points[point_type];
			point_stats.percent = point_stats.count / real_score;
		});

		// update score
		this.data.score.current = real_score;
		this.data.score.runway =
			real_score + getRunway(this.data.start_level, RUNWAY.GAME, real_score);

		this.onScore();
	}

	_doPiece(data) {
		let cur_piece;

		if (this.is_classic_rom) {
			if (this.num_pieces === 0) {
				cur_piece = PIECES.find(p => data[p]); // first truthy value is piece
			} else {
				cur_piece = this.prior_preview; // should be in sync 🤞
			}

			// record new state
			this.num_pieces = this._getNumPieces(data);
			PIECES.forEach(p => (this.data[p] = data[p]));
			this.prior_preview = data.preview;
		} else {
			cur_piece = data.cur_piece; // 💪
			this.das_total += data.cur_piece_das;
		}

		this.pieces.push(cur_piece);

		if (cur_piece == 'I') {
			if (this.cur_drought > this.max_drought) {
				this.max_drought = this.cur_drought;
			}

			this.cur_drought = 0;
		} else {
			if (++this.cur_drought === 13) {
				this.num_droughts += 1;
			}
		}
	}

	getReport() {
		if (!this.data) return null;

		let tetris_rate = null;
		let das_avg = -1;

		if (this.clears.length) {
			tetris_rate = this.tetris_lines / this.data.lines;
		}

		if (this.pieces.length && this.das_total) {
			das_avg = this.das_total / this.pieces.length;
		}

		return {
			start_level: this.start_level,
			end_level: this.data.level,
			score: this.data.score,
			lines: this.data.lines,
			num_droughts: this.num_droughts,
			max_drought: this.max_drought,
			duration: this.end_ts
				? this.end_ctime - this.start_ctime
				: Date.now() - this.start_ts,
			transition: this.transition,
			clears: this.clears.join(''),
			pieces: this.pieces.join(''),

			tetris_rate,
			das_avg,

			num_frames: this.num_frames,
			frame_file: this.frame_file,
		};
	}

	getFrame(idx) {
		return this.frames[idx];
	}

	getLastFrame() {
		return peek(this.frames);
	}

	getFrameAtElapsed(ms /* 0 based */) {
		return fuzzyBinarySearchWithLowerBias(
			this.frames,
			'ctime',
			this.start_ctime + ms
		)[1];
	}

	// TODO: change callbacks to emit events instead
	onValidFrame() {}
	onScore() {}
	onPiece() {}
	onLines() {}
	onLevel() {}
	onDasLoss() {}
	onTransition() {}
	onKillScreen() {}
	onDroughtStart() {}
	onDroughtEnd() {}
	onGameStart() {}
	onGameOver() {}
	onCurtainDown() {}
	onTetris() {}
}
