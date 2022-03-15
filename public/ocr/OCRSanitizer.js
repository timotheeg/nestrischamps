import QueryString from '/js/QueryString.js';
import ScoreFixer from '/ocr/ScoreFixer.js';
import LevelFixer from '/ocr/LevelFixer.js';

const FIX_LEVEL = QueryString.get('fixlevel') !== '0';

const requested_buffer_size = parseInt(QueryString.get('fixbuffer'), 10);

const BUFFER_MAXSIZE =
	!isNaN(requested_buffer_size) &&
	requested_buffer_size > 0 &&
	requested_buffer_size < 5
		? requested_buffer_size
		: 1;

function peek(arr, offset = 0) {
	return arr[arr.length - (offset + 1)];
}

/*
 * OCRSanitizer sanitizes a stream of Tetris OCRed data.
 *
 * That is because with intelaced input, a change occurs over 2 frame.
 * Reading a value as soon as it is changed can yield incorrect values, since the OCR was performed on
 * a transition interlaced frame
 *
 * So, each change is buffered for 1 frame to hopefully read a clean stable value.
 *
 * The buffering is done with an understanding of how Tetris fields are connected
 * Score: may change independently (push down points)
 * Lines: can only increase if score increase
 * Level: can only increase if lines increase
 * Piece counters: Can change independently (but only one at a time!)
 * Instant Das: changes at every frame: cannot be buffered to stability (read and hope for the best)
 * Cur piece Das: Changes on piece change
 * Preview: Can change independently
 * Cur piece:  Can change independently
 *
 * The Sanitizer Also corrects invalid detection on the high scores and level, where scores greater than 1M are rendered with letter.
 */

export default class OCRSanitizer {
	constructor(tetris_ocr, config) {
		this.config = config;
		this.tetris_ocr = tetris_ocr;

		this.frame_buffer = [];

		this.score_fixer = new ScoreFixer();
		this.level_fixer = new LevelFixer();

		this._prefillFrameBuffer = this._prefillFrameBuffer.bind(this);
		this._sanitize = this._sanitize.bind(this);

		this.tetris_ocr.onMessage = this._prefillFrameBuffer;

		this.gameid = 1;
		this.in_game = false;

		this.score_frame_delay = 0;
		this.piece_frame_delay = 0;
	}

	onMessage() {
		// class user to implement
	}

	_prefillFrameBuffer(data) {
		this.frame_buffer.push(data); // assume good frame at the beginning - what to do 🤷

		if (this.frame_buffer.length >= BUFFER_MAXSIZE) {
			this.tetris_ocr.onMessage = this._sanitize;
		}
	}

	_sanitize(data) {
		performance.mark('start_sanitize');

		if (--this.score_frame_delay > 0) {
			// just wait
		} else if (this.score_frame_delay === 0) {
			this.frame_buffer.forEach(frame => {
				frame.score = data.score;
				frame.lines = data.lines;
				frame.level = data.level;
			});
		} else if (
			!OCRSanitizer.arrEqual(data.score, peek(this.frame_buffer).score)
		) {
			this.score_frame_delay = this.frame_buffer.length;
		}

		// ==========

		// mutually exclusive check for piece checks based on selected rom
		if (this.config.tasks.T) {
			// In classic rom, we have several way of determining the cur_piece
			// 1. on piece change, cur_piece is the previous preview
			// 2. on piece change, cur_piece if the piece with the last incremented counter
			// So... Should this populate the cur_piece? it's not OCR...
			// then again, the corrections are not really OCR too either
			// TODO: populate cur_piece into the frame for classic rom (maybe?)
			if (--this.piece_frame_delay > 0) {
				// just wait
			} else if (this.piece_frame_delay === 0) {
				this.frame_buffer.forEach(frame => {
					frame.preview = data.preview;
					frame.T = data.T;
					frame.J = data.J;
					frame.Z = data.Z;
					frame.O = data.O;
					frame.S = data.S;
					frame.L = data.L;
					frame.I = data.I;
				});
			} else if (
				!OCRSanitizer.pieceCountersEqual(data, peek(this.frame_buffer))
			) {
				this.piece_frame_delay = this.frame_buffer.length;
			}
		} else if (this.config.tasks.instant_das) {
			if (--this.piece_frame_delay > 0) {
				// just wait
			} else if (this.piece_frame_delay === 0) {
				this.frame_buffer.forEach(frame => {
					frame.preview = data.preview;
					frame.cur_piece = data.cur_piece;
					frame.cur_piece_das = data.cur_piece_das;
				});
			} else {
				const last_frame = peek(this.frame_buffer);
				if (
					data.preview != last_frame.preview ||
					data.cur_piece != last_frame.cur_piece ||
					!OCRSanitizer.arrEqual(data.cur_piece_das, last_frame.cur_piece_das)
				) {
					this.piece_frame_delay = this.frame_buffer.length;
				}
			}
		}

		this.frame_buffer.push(data);

		performance.mark('end_sanitize');
		performance.measure('sanitize', 'start_sanitize', 'end_sanitize');

		// ==========
		// we have now corrected the reads to be on stable values
		// the stable values may still be incorrect with regards to the 8-B and 4-A detection
		// but that wouldbe fixed in the next step

		// inform listener that a frame is ready
		this._emitLastFrameData();
	}

	_emitLastFrameData() {
		performance.mark('start_fix_and_convert');

		const dispatch_frame = this.frame_buffer.shift();

		// replicate NESTrisOCR gameid logic
		// also check if the fixers must be reset
		if (
			dispatch_frame.lines == null ||
			dispatch_frame.score == null ||
			dispatch_frame.level == null
		) {
			this.in_game = false;
		} else if (!this.in_game) {
			this.in_game = true;

			if (
				OCRSanitizer.arrEqual(dispatch_frame.score, [0, 0, 0, 0, 0, 0]) &&
				(OCRSanitizer.arrEqual(dispatch_frame.lines, [0, 0, 0]) || // mode A
					OCRSanitizer.arrEqual(dispatch_frame.lines, [0, 2, 5])) // mode B
			) {
				this.gameid++;

				this.score_fixer.reset();
				this.score_fixer.fix(dispatch_frame.score);

				if (FIX_LEVEL) {
					this.level_fixer.reset();
					this.level_fixer.fix(dispatch_frame.level);
				}
			}
		}

		const pojo = {
			gameid: this.gameid,
			lines: OCRSanitizer.digitsToValue(dispatch_frame.lines),
			field: dispatch_frame.field,
			preview: dispatch_frame.preview,

			score: OCRSanitizer.digitsToValue(
				this.score_fixer.fix(dispatch_frame.score)
			), // note: nulls are passthrough
			level: OCRSanitizer.digitsToValue(
				FIX_LEVEL
					? this.level_fixer.fix(dispatch_frame.level)
					: OCRSanitizer.arrEqual(dispatch_frame.level, [10, 9])
					? [6, 1] // special correction for Cheez 2.3M game with broken Tetris Gym 🤷
					: dispatch_frame.level
			), // note: nulls are passthrough
		};

		if (this.config.tasks.T) {
			pojo.T = OCRSanitizer.digitsToValue(dispatch_frame.T);
			pojo.J = OCRSanitizer.digitsToValue(dispatch_frame.J);
			pojo.Z = OCRSanitizer.digitsToValue(dispatch_frame.Z);
			pojo.O = OCRSanitizer.digitsToValue(dispatch_frame.O);
			pojo.S = OCRSanitizer.digitsToValue(dispatch_frame.S);
			pojo.L = OCRSanitizer.digitsToValue(dispatch_frame.L);
			pojo.I = OCRSanitizer.digitsToValue(dispatch_frame.I);

			pojo.color1 = dispatch_frame.color1;
			pojo.color2 = dispatch_frame.color2;
			pojo.color3 = dispatch_frame.color3;
		} else {
			pojo.instant_das = OCRSanitizer.digitsToValue(dispatch_frame.instant_das);
			pojo.cur_piece_das = OCRSanitizer.digitsToValue(
				dispatch_frame.cur_piece_das
			);
			pojo.cur_piece = dispatch_frame.cur_piece;
		}

		performance.mark('end_fix_and_convert');
		performance.measure(
			'fix_and_convert',
			'start_fix_and_convert',
			'end_fix_and_convert'
		);

		this.onMessage(pojo);
	}
}

OCRSanitizer.digitsToValue = function digitsToValue(digits) {
	if (digits === null) return null;

	return digits.reduce(
		(acc, v, idx) => acc + v * Math.pow(10, digits.length - idx - 1),
		0
	);
};

OCRSanitizer.arrEqual = function arrEqual(arr1, arr2) {
	return (
		(arr1 === null && arr2 === null) ||
		(arr1 &&
			arr2 &&
			arr1.length === arr2.length &&
			arr1.every((v, i) => v === arr2[i]))
	);
};

OCRSanitizer.pieceCountersEqual = function pieceCountersEqual(frame1, frame2) {
	return (
		OCRSanitizer.arrEqual(frame1.T, frame2.T) &&
		OCRSanitizer.arrEqual(frame1.J, frame2.J) &&
		OCRSanitizer.arrEqual(frame1.Z, frame2.Z) &&
		OCRSanitizer.arrEqual(frame1.O, frame2.O) &&
		OCRSanitizer.arrEqual(frame1.S, frame2.S) &&
		OCRSanitizer.arrEqual(frame1.L, frame2.L) &&
		OCRSanitizer.arrEqual(frame1.I, frame2.I)
	);
};
