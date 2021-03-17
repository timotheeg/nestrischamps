const OCRSanitizer = (function() {

function digitsToValue(digits) {
	return digits.reverse().reduce((acc, v, idx) => acc += v * Math.pow(10, idx), 0);
}

class OCRSanitizer {
	constructor(tetris_ocr, config) {
		this.config = config;
		this.tetris_ocr = tetris_ocr;

		this.last_frame = null;

		this.score_fixer = new ScoreFixer();
		this.level_fixer = new LevelFixer();

		this.sanitize = timingDecorator('sanitize', this.sanitize.bind(this));

		tetris_ocr.onMessage(this.sanitize);

		this.gameid = 0;
		this.in_game = false;

		this.pending_score = false;
		this.pending_line = false;
		this.pending_piece = false;
	}


	sanitize(res) {
		if (res.lines == null || res.score == null || res.level == null) {
			this.in_game = false;
		}
		else if (!this.in_game) {
			// first frame of new game - set initial state from it
			this.in_game = true;
			this.gameid++;
			this.pending_lines = false;
			this.pending_score = false;
			this.pending_piece = false;

			this.last_frame = res;

			this.score_fixer.reset();
			this.score_fixer.fix(score_digits);

			this.level_fixer.reset();
			this.level_fixer.fix(ldevel_digits);

			return;
		}


		this.frame_buffer.push(res);

		if (this.frame_buffer.length > FRAME_BUFFER_SIZE) {
			this.onMessage(this.frame_buffer.shift());
		}
	}

	getValues(res) {
		const pojo = {
			score:     digitsToValue(res.score),
			lines:     digitsToValue(res.lines),
			level:     digitsToValue(res.level),
			field:     res.field,
			preview:   res.preview,
		};

		if (this.config.tasks.T) {
			pojo.T = digitsToValue(res.T);
			pojo.J = digitsToValue(res.J);
			pojo.Z = digitsToValue(res.Z);
			pojo.O = digitsToValue(res.O);
			pojo.S = digitsToValue(res.S);
			pojo.L = digitsToValue(res.L);
			pojo.I = digitsToValue(res.I);
		}
		else {
			popo.instant_das = digitsToValue(res.instant_das);
			popo.cur_piece_das = digitsToValue(res.cur_piece_das);
			popo.cur_piece = res.cur_piece;
		}

		return pojo;
	}
}

})();