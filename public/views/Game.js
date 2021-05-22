class Game {
	constructor(event) {
		this.id = event.gameid;
		this.over = false;
		this.start_ts = Date.now();

		// will store all pieces that have been played in the game
		this.pieces = [];

		this.line_events = []; // entry will be added every time lines are cleared

		const lines = event.lines || 0;
		const score = event.score || 0;
		const level = event.level || 0;

		this.data = {
			start_level: level,

			level: level,
			burn:  0,

			score: {
				current:    score,
				runway:     score + getRunway(level, RUNWAY.GAME, lines),
				tr_runway:  score + getRunway(level, RUNWAY.TRANSITION, lines),
				normalized: 0,
				transition: null
			},

			i_droughts: {
				count: 0,
				cur:   0,
				last:  0,
				max:   0
			},

			das: {
				cur:   0,
				total: 0, // running total, used for average computation
				avg:   0,
				great: 0,
				ok:    0,
				bad:   0
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
				count: event.score,
				drops: {
					count:   0,
					percent: 0
				}
			}
		}

		PIECES.forEach(name => {
			this.data.pieces[name] = {
				count:   0,
				percent: 0,
				drought: 0,
				indexes: []
			}
		});

		[1, 2, 3, 4].forEach(name => {
			this.data.lines[name] = {
				count:   0,
				lines:   0,
				percent: 0
			};

			this.data.points[name] = {
				count:   0,
				percent: 0
			};
		});
	}

	setFrame(frame) {
		// TODO Game should understand frame sequences
		// Consumer app should track when a new game starts and instantiate a new game
	}

	onDasLoss() {
		if (!this.pieces.length) return;

		this.pieces[this.pieces.length - 1].das_loss = true;
	}

	// event: {score, level, lines, das, cur_piece, next_piece, }
	onPiece(event) {
		const p = event.cur_piece;

		this.data.pieces.count++;
		this.data.pieces[p].count++;

		// computation for the variance
		let distance_square = 0;

		PIECES.forEach(name => {
			const stats = this.data.pieces[name];

			stats.percent = stats.count / this.data.pieces.count;

			distance_square += Math.pow(stats.count/this.data.pieces.count - 1/7, 2);

			stats.drought++;
		});

		this.data.pieces[p].drought = 0;
		this.data.pieces.deviation = Math.sqrt(distance_square / PIECES.length);
		this.data.pieces.deviation_28 = this.data.pieces.deviation;
		this.data.pieces.deviation_56 = this.data.pieces.deviation;

		if (p != 'I') {
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
		else {
			if (this.data.i_droughts.cur > 0) {
				this.data.i_droughts.last = this.data.i_droughts.cur;
			}

			this.data.i_droughts.cur = 0;
		}

		// update das
		const das_stats = this.data.das;
		das_stats.cur   =  event.cur_piece_das;
		das_stats.total += event.cur_piece_das;
		das_stats.avg   =  das_stats.total / this.data.pieces.count;
		das_stats[DAS_THRESHOLDS[das_stats.cur]]++; // great, ok, bad

		this.board = new Board(event.stage.field_string); // TODO: rewrite board to use the field array

		const piece_data = {
			piece:      p,
			das:        event.cur_piece_das,
			index:      this.pieces.length,
			board:      this.board.stats,
			in_drought: this.data.i_droughts.cur >= DROUGHT_PANIC_THRESHOLD,
		};

		this.pieces.push(piece_data);
		this.data.pieces[p].indexes.push(piece_data);

		const len = this.pieces.length;

		if (len > 28) {
			// compute the 28 and 56 deviation
			// TODO: compute over "true" bags, that would always yield 0 deviation in modern tetrises
			const counts = {};

			PIECES.forEach(name => counts[name] = 0);

			for (let offset=28; offset>0; offset--) {
				counts[game.pieces[len - offset].piece]++;
			}

			this.data.pieces.deviation_28 = Math.sqrt(Object.values(counts).reduce((sum, count) => sum + Math.pow(count/28 - 1/7, 2), 0) / PIECES.length);

			if (this.data.pieces.count >= 56) {
				for (let offset=28; offset>0; offset--) {
					counts[game.pieces[len - 28 - offset].piece]++;
				}

				this.data.pieces.deviation_56 = Math.sqrt(Object.values(counts).reduce((sum, count) => sum + Math.pow(count/56 - 1/7, 2), 0) / PIECES.length);
			}
		}
	}

	onLine(event) {
		const
			num_lines    = event.lines - this.data.lines.count,
			lines_score  = this.getScore(event.level, num_lines),
			actual_score = event.score - this.data.score.current;

		// update total lines and points
		this.data.lines.count = event.lines;
		this.data.points.count = event.score;

		// update drop score
		this.data.points.drops.count += actual_score - lines_score;

		if (num_lines) {
			if (num_lines > 0 && num_lines <= 4) {
				this.data.score.normalized += EFF_LINE_VALUES[num_lines] * num_lines;

				// update lines stats for clearing type (single, double, etc...)
				this.data.lines[num_lines].count += 1;
				this.data.lines[num_lines].lines += num_lines;

				// update points stats for clearing type (single, double, etc...)
				this.data.points[num_lines].count += lines_score;

				// update percentages for everyone
				for (let clear_type=4; clear_type; clear_type--) {
					const line_stats = this.data.lines[clear_type];
					line_stats.percent = line_stats.lines / this.data.lines.count;
				}
			}
			else {
				// TODO: how to recover
				console.log('invalid num_lines', num_lines, event);
			}

			const line_event = {
				num_lines,
				tetris_rate: this.data.lines[4].percent,
				efficiency: this.data.score.normalized / event.lines / 300,
			};

			// record line event
			this.line_events.push(line_event);
			this.pieces[this.pieces.length - 1].lines = line_event;
		}

		// update percentages for all clear types
		for (let clear_type = 4; clear_type; clear_type--) {
			const point_stats = this.data.points[clear_type];
			point_stats.percent = point_stats.count / event.score;
		}

		// update stat for drops
		this.data.points.drops.percent = this.data.points.drops.count / event.score;

		// update score
		this.data.score.current = event.score;
		this.data.score.runway = event.score + getRunway(this.data.start_level, RUNWAY.GAME, event.lines);

		// check transition score
		if (event.level > this.data.level) {
			if (this.data.score.transition === null && event.level === this.data.start_level + 1) {
				this.data.score.transition = event.score;
				this.data.score.tr_runway = event.score;
			}
		}

		if (this.data.score.transition === null) {
			this.data.score.tr_runway = event.score + getRunway(this.data.start_level, RUNWAY.TRANSITION, event.lines);
		}

		// update level
		this.data.level = event.level;

		// update burn if needed
		if (num_lines) {
			if (num_lines < 4) {
				this.data.burn += num_lines;
			}
			else {
				this.data.burn = 0;
			}
		}
	}

	getScore(level, num_lines) {
		return SCORE_BASES[num_lines] * (level + 1)
	}

	setGameOver() {
		this.over = true;
		this.end_ts = Date.now();
	}

	getReport() {
		// Get the relevant data from the game report
		return {
			...this.data,

			gameid: this.id,
			duration: (this.end_ts || Date.now()) - this.start_ts,
			timeline: {
				clears: this.line_events.map(evt => evt.num_lines).join(''),
				pieces: this.pieces.map(evt => evt.piece).join('')
			}
		};
	}

	toString(encoding='json') {
		return JSON.stringify(this.data);
	}
}