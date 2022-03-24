// Minimum amount of game tracking to do server side to be able to report games
import ArrayView from './ArrayView.js';
import BinaryFrame from '/js/BinaryFrame.js';
import Board from '/views/Board.js';
import { peek } from '/views/utils.js';
import {
	PIECES,
	DROUGHT_PANIC_THRESHOLD,
	SCORE_BASES,
	DAS_THRESHOLDS,
	RUNWAY,
	EFF_LINE_VALUES,
	CLEAR_ANIMATION_NUM_FRAMES,
	getRunway,
} from '/views/constants.js';

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

const DEFAULT_OPTIONS = {
	usePieceStats: false,
	seekableFrames: true,
};

export default class BaseGame {
	constructor(options) {
		this.options = {
			...DEFAULT_OPTIONS,
			...options,
		};

		this.start_ts = 0;
		this.data = null;
		this.over = false;
		this.num_frames = 0;
		this.frames = [];
	}

	// Declare events
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
	onNewGame() {}
	onCurtainDown() {}
	onTetris() {}

	end() {
		if (!this.over) {
			this._doGameOver();
		}
	}

	setFrame(frame) {
		if (frame.score === null || frame.lines === null || frame.level === null) {
			// not in game
			return;
		}

		if (!this.data) {
			// Game initialization frame - Assume good
			this._doStartGame(frame);
			return;
		}

		if (frame.gameid != this.gameid) {
			this.end();
			this.onNewGame(frame);
			return;
		}

		if (this.over) {
			return;
		}

		const score_events = this._checkScore(frame);
		const piece_events = this._checkPiece(frame);
		const last_frame = this._addFrame(frame);

		// check for das loss
		if (!this.is_classic_rom && last_frame.raw.instant_das === 0) {
			peek(this.pieces).das_loss = true;
		}

		// Fire events as needed
		if (score_events) {
			this.onScore(last_frame);
			if (score_events.lines) this.onLines(last_frame);
			if (score_events.level) this.onLevel(last_frame);
			if (score_events.transition) this.onTransition(last_frame);
		}

		if (piece_events) {
			this.onPiece(last_frame);
		}

		this.onValidFrame(last_frame);

		// Check board for gameover event (curtain has fallen)
		if (this.data.num_blocks >= 200) {
			this.end();
		}
	}

	_doStartGame(frame) {
		this.gameid = frame.gameid;
		this.start_ctime = frame.ctime;
		this.start_ts = Date.now();
		this.is_classic_rom = frame.game_type === BinaryFrame.GAME_TYPE.CLASSIC;

		this.points = [];
		this.clears = [];
		this.pieces = [];

		this.array_views = {
			pieces: [],
			points: [],
			clears: [],
		};

		// this.data is used to track game stats and data as they progress
		// snapshots of them will be stored in frames as needed
		this.data = {
			start_level: frame.level,

			lines: frame.lines,
			level: frame.level,
			field: frame.field,

			running_stats: {
				tetris_rate: 0,
				efficiency: 0,
				burn: 0,
			},

			score: {
				current: frame.score,
				tr_runway:
					frame.score + getRunway(frame.level, RUNWAY.TRANSITION, frame.lines),
				runway: frame.score + getRunway(frame.level, RUNWAY.GAME, frame.lines),
				projection:
					frame.score + getRunway(frame.level, RUNWAY.GAME, frame.lines),
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
			},

			clears: {},

			points: {
				drops: {
					count: 0, // "count" is a bad name
					percent: 0,
				},
			},

			num_blocks: this._getNumBlocks(frame),
		};

		PIECES.forEach(name => {
			this.data.pieces[name] = {
				count: 0,
				percent: 0,
				drought: 0,
				indexes: [],
			};

			this.array_views[name] = [];
		});

		[1, 2, 3, 4].forEach(name => {
			this.data.clears[name] = {
				count: 0,
				lines: 0,
				percent: 0,
			};

			this.data.points[name] = {
				count: 0,
				percent: 0,
			};
		});

		this._recordPointEvent();
		this._addFrame(frame);

		// custom "funny" logic to handle start of the game
		if (this.options.usePieceStats) {
			this.pending_piece = false;
		} else {
			this.pending_piece = this.data.num_blocks != 0;
		}

		this.pending_score = false;
		this.clear_animation_remaining_frames = 0;
		this.full_rows = [];
		this.last_negative_diff = null;

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
			raw: data,

			pieces: this.array_views.pieces,
			points: this.array_views.points,
			clears: this.array_views.clears,
		};

		this.frames.push(frame);

		return frame;
	}

	_checkScore(data) {
		if (this.pending_score) {
			this.pending_score = false;
			return this._doScore(data);
		}

		if (data.score === 999999) {
			this.pending_score = data.lines != this.data.lines;
		} else {
			const high_score = this.data.score.current / 1600000;

			if (high_score >= 1) {
				this.pending_score = data.score != this.data.score.current % 1600000;
			} else {
				this.pending_score = data.score != this.data.score.current;
			}
		}
	}

	_doScore(data) {
		const events = {
			transition: false,
			level: false,
			lines: false,
		};

		const cleared = data.lines - this.data.lines;
		const lines_score = (SCORE_BASES[cleared] || 0) * (data.level + 1);

		let real_score = data.score;

		if (
			data.score === 999999 &&
			this.data.score.current + lines_score >= 999999
		) {
			// Compute score beyond maxout
			real_score = this.data.score.current + lines_score;
		} else if (data.score < this.data.score.current) {
			const num_wraps = Math.floor(
				(this.data.score.current + lines_score) / 1600000
			);

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

		const score_increment = real_score - this.data.score.current;

		this.data.points.drops.count += Math.max(0, score_increment - lines_score);
		this.data.lines = data.lines;

		// point evet to track snapshot of state
		// when score changes, lines may have changed
		if (cleared) {
			events.lines = true;
			if (cleared > 0 && cleared <= 4) {
				this.data.score.normalized += EFF_LINE_VALUES[cleared] * cleared;

				// update lines stats for clearing type (single, double, etc...)
				this.data.clears[cleared].count += 1;
				this.data.clears[cleared].lines += cleared;

				// update points stats for clearing type (single, double, etc...)
				this.data.points[cleared].count += lines_score;

				// update percentages for everyone
				CLEAR_TYPES.forEach(clear_type => {
					const clear_stats = this.data.clears[clear_type];
					clear_stats.percent = clear_stats.lines / data.lines;
				});
			} else {
				console.warn(`Invalid clear: ${cleared} lines`);
			}

			this.data.running_stats.tetris_rate = this.data.clears[4].percent;
			this.data.running_stats.efficiency =
				this.data.score.normalized / data.lines;

			if (cleared === 4) {
				this.data.running_stats.burn = 0;
			} else {
				this.data.running_stats.burn += cleared;
			}

			// when line changes, level may have changed
			if (data.level != this.data.level) {
				events.level = true;
				this.data.level = data.level;

				if (this.transition === null) {
					events.transition = true;
					this.data.score.transition = real_score;
					this.data.score.tr_runway = real_score;
				}
			} else if (this.transition === null) {
				this.data.score.tr_runway =
					real_score +
					getRunway(this.data.start_level, RUNWAY.TRANSITION, data.lines);
			}

			this._recordLineClearEvent(cleared);
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
		this.data.score.projection =
			(this.data.score.runway * this.data.running_stats.efficiency) / 300;

		// record point event with snapshot of all data
		this._recordPointEvent();

		return events;
	}

	_recordPointEvent() {
		const evt = {
			score: { ...this.data.score },
			points: POINT_TYPES.reduce((acc, type) => {
				acc[type] = { ...this.data.points[type] };
				return acc;
			}, {}),
		};
		this.points.push(evt);
		this.array_views.points = new ArrayView(this.points);
	}

	_recordLineClearEvent(cleared) {
		const evt = {
			...this.data.running_stats,
			cleared,
			clears: CLEAR_TYPES.reduce((acc, type) => {
				acc[type] = { ...this.data.clears[type] };
				return acc;
			}, {}),
		};
		this.clears.push(evt);
		this.array_views.clears = new ArrayView(this.clears);

		// record the fact that the last piece caused a clear event
		// warning this assume order that score/clear events are ALWAYS processes becfore checking pieces
		peek(this.pieces).clear = evt;
	}

	_checkPiece(data) {
		if (this.pending_piece) {
			if (!data.preview) return;

			this.pending_piece = false;
			return this._doPiece(data);
		}

		if (this.is_classic_rom && this.options.usePieceStats) {
			// TODO: allow classic rom to work with block count with a query string arg
			if (this._getNumPieces(data) != this.pieces.length) {
				this.pending_piece = true;
			}

			return;
		}

		// Code below detect pieces by detecting block changes in the field
		// Works for Das Trainer where there is no piece stats

		if (this._isSameField(data)) return;
		if (this.clear_animation_remaining_frames-- > 0) return;

		const cur_num_blocks = this._getNumBlocks(data);
		const block_diff = cur_num_blocks - this.data.num_blocks;

		if (block_diff === 0) {
			this.full_rows = Array(20)
				.fill()
				.map((_, ridx) => {
					return Array(10)
						.fill()
						.every((_, cidx) => data.field[ridx * 10 + cidx])
						? ridx
						: 0;
				})
				.filter(v => v);

			this.last_negative_diff = null;

			return;
		}

		if (block_diff === 4) {
			this.data.field = data.field;
			this.data.num_blocks = cur_num_blocks;
			this.pending_piece = true;
			this.full_rows.length = 0;
			this.last_negative_diff = null;
			return;
		}

		if (block_diff > 0 || !ALL_POSSIBLE_NEGATIVE_DIFFS.includes(block_diff)) {
			this.full_rows.length = 0;
			this.last_negative_diff = null;
			return;
		}

		// when we reach here block_diff is a *valid* negative diff
		// we look for 2 valid consecutive negative diffs to detect a line clear animation

		// We only use the full rows data for triple and tetris
		// That is in the hope that we can fire the Tetris Flash
		if (this.full_rows.length > 2) {
			const clears = CLEAR_DIFFS[this.full_rows.length - 1];
			const clear_frame_idx = clears.indexOf(block_diff);

			if (clear_frame_idx >= 0) {
				// we found the clear!
				this.clear_animation_remaining_frames =
					CLEAR_ANIMATION_NUM_FRAMES - 1 - clear_frame_idx;
				this.data.num_blocks -= this.full_rows.length * 10;

				if (this.full_rows.length === 4) {
					this.onTetris();
				}

				this.full_rows.length = 0;
				this.last_negative_diff = null;
				return;
			}
		} else if (
			this.last_negative_diff != null &&
			this.last_negative_diff != block_diff
		) {
			// inspect all clear diffs to see if we have 2 consecutive values
			for (let clear = CLEAR_DIFFS.length; clear > 0; clear--) {
				if (!CLEAR_DIFFS[clear - 1].includes(this.last_negative_diff)) continue;

				const clear_frame_idx = CLEAR_DIFFS[clear - 1].indexOf(block_diff);

				if (clear_frame_idx < 0) continue;

				// we found the clear!
				this.clear_animation_remaining_frames =
					CLEAR_ANIMATION_NUM_FRAMES - 1 - clear_frame_idx;
				this.data.num_blocks -= clear * 10;

				if (clear === 4) {
					this.onTetris();
				}

				this.full_rows.length = 0;
				this.last_negative_diff = null;
				return;
			}
		}

		this.last_negative_diff = block_diff;
		this.full_rows.length = 0;
	}

	_doPiece(data) {
		const events = {};

		let cur_piece;

		if (this.pieces.length <= 0) {
			if (data.cur_piece) {
				cur_piece = data.curPiece;
			} else if (this.is_classic_rom) {
				cur_piece = PIECES.find(p => data[p]); // first truthy value is piece - not great when recording starts mid-game
			} else {
				console.warn('Unable to detect first piece - picking O arbitrarily');
				cur_piece = 'O';
			}
		} else {
			cur_piece = this.prior_preview; // should be in sync 🤞
		}

		this.prior_preview = data.preview;

		if (this.is_classic_rom) {
			// fake das stats
			this.data.das.cur = -1;
		} else {
			// record real das stats
			this.data.das.cur = data.cur_piece_das;
			this.data.das.total += data.cur_piece_das;
			this.data.das.avg = this.data.das.total / (this.pieces.length + 1); // +1 because we add piece event to array later
			this.data.das[DAS_THRESHOLDS[this.data.das.cur]]++; // great, ok, bad
		}

		this.data.pieces.count++;
		this.data.pieces[cur_piece].count++;

		// handle droughts
		PIECES.forEach(name => {
			const stats = this.data.pieces[name];
			stats.drought++; // all droughts increase
			stats.percent = stats.count / this.data.pieces.count;
		});
		this.data.pieces[cur_piece].drought = 0; // current piece drought resets

		// handle I droughts
		if (cur_piece === 'I') {
			if (this.data.i_droughts.cur > 0) {
				this.data.i_droughts.last = this.data.i_droughts.cur;
			}
			this.data.i_droughts.cur = 0;
		} else {
			this.data.i_droughts.cur++;

			if (this.data.i_droughts.cur == DROUGHT_PANIC_THRESHOLD) {
				this.data.i_droughts.count++;

				// mark past pieces as being in drought
				for (let offset = DROUGHT_PANIC_THRESHOLD - 1; offset > 0; offset--) {
					this.pieces[this.pieces.length - offset].in_drought = true;
				}
			}

			if (this.data.i_droughts.cur > this.data.i_droughts.max) {
				this.data.i_droughts.max = this.data.i_droughts.cur;
			}
		}

		// record piece event before calculating deviation, so the array fuly represent the sequence
		// we will update piece event with the deviation reactively
		this._recordPieceEvent(cur_piece, data);

		// Handle deviation
		let distance_square = 0;

		const last_piece_event = peek(this.pieces);

		PIECES.forEach(name => {
			const stats = this.data.pieces[name];

			distance_square += Math.pow(stats.count / this.pieces.length - 1 / 7, 2);
		});

		last_piece_event.deviation =
			last_piece_event.deviation_28 =
			last_piece_event.deviation_56 =
				Math.sqrt(distance_square / PIECES.length);

		// handle deviation
		const len = this.pieces.length;

		if (len > 28) {
			// compute the 28 and 56 deviation
			// TODO: compute over "true" bags, that would always yield 0 deviation in modern tetrises
			const counts = {};

			PIECES.forEach(name => (counts[name] = 0));

			for (let offset = 28; offset > 0; offset--) {
				counts[this.pieces[len - offset].piece]++;
			}

			last_piece_event.deviation_28 = Math.sqrt(
				Object.values(counts).reduce(
					(sum, count) => sum + Math.pow(count / 28 - 1 / 7, 2),
					0
				) / PIECES.length
			);

			if (len >= 56) {
				for (let offset = 28; offset > 0; offset--) {
					counts[this.pieces[len - 28 - offset].piece]++;
				}

				last_piece_event.deviation_56 = Math.sqrt(
					Object.values(counts).reduce(
						(sum, count) => sum + Math.pow(count / 56 - 1 / 7, 2),
						0
					) / PIECES.length
				);
			}
		}

		return events;
	}

	_recordPieceEvent(piece, data) {
		const evt = {
			piece,
			in_drought: this.data.i_droughts.cur >= DROUGHT_PANIC_THRESHOLD,
			index: this.pieces.length,
			i_droughts: { ...this.data.i_droughts },
			das: { ...this.data.das }, // TODO, make this more efficient for classic rom, no need to carry das object copies
			pieces: { ...this.data.pieces }, // copy all including pieces - duplicate action below :'(
			board: new Board(data.field).stats,
		};

		// update tracker arrays
		this.pieces.push(evt);
		this.data.pieces[piece].indexes.push(evt);

		// update aray view snapshots
		this.array_views.pieces = new ArrayView(this.pieces);
		this.array_views[piece] = new ArrayView(this.data.pieces[piece].indexes);

		// update event object
		PIECES.forEach(name => {
			evt.pieces[name] = {
				...this.data.pieces[name],
				indexes: this.array_views[name],
			};
		});
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
}
