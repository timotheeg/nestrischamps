class Row {
	constructor(line, row_idx) {
		this.cells = line.split('');
		this.idx = row_idx;

		const emptys = (this.emptys = []);

		this.cells.forEach((val, idx) => {
			if (val === '0') emptys.push(idx);
		});

		if (emptys.length === 1) {
			this.well = emptys[0] + 1;
		}
	}
}

class Column {
	constructor(cells, col_idx) {
		this.cells = cells;
		this.idx = col_idx;

		const len = this.cells.length;

		this.top_fill_idx = len;

		for (let idx = 0; idx < len; idx++) {
			if (this.cells[idx] != '0') {
				this.top_fill_idx = idx;
				break;
			}
		}

		this.has_holes = this.cells.indexOf('0', this.top_fill_idx) > -1;
	}
}

class Board {
	constructor(board_str) {
		this.rows = Array();

		const columns = Array(10)
			.fill()
			.map((_) => []);

		let top_seen = false;
		let top_idx = 2;

		for (let yidx = 20; yidx--; ) {
			let row;

			if (!top_seen) {
				row = new Row(board_str.substr(10 * yidx, 10), 20 - this.rows.length);

				if (row.emptys.length === 10) {
					top_seen = true;
					top_idx = yidx + 1;
				}
			} else {
				// removes falling piece
				row = new Row('0000000000', this.rows.length);
			}

			this.rows.unshift(row);

			row.cells.forEach((value, idx) => {
				columns[idx].unshift(value);
			});
		}

		this.columns = columns.map((col, idx) => new Column(col, idx));

		this.tetris_top_row = this.getTetrisTopRow();

		this.stats = {
			top_idx,
			tetris_ready: !!this.tetris_top_row,
			clean_slope: this.hasPerfectSlope(),
			double_well: this.hasDoubleWell(),
		};
	}

	getTetrisTopRow() {
		for (let idx = this.rows.length; idx-- > 4; ) {
			const row = this.rows[idx];

			if (!row.well) continue;

			// blocked below and free above
			if (this.columns[row.well - 1].top_fill_idx !== idx + 1) continue;

			// well is 4 row deep
			if (
				row.well != this.rows[idx - 1].well ||
				row.well != this.rows[idx - 2].well ||
				row.well != this.rows[idx - 3].well
			)
				continue;

			return this.rows[idx - 3];
		}

		return null;
	}

	hasPerfectSlope() {
		let height_idx = -1;

		for (let col of this.columns) {
			if (col.has_holes) return false;
			if (col.top_fill_idx < height_idx) return false;

			height_idx = col.top_fill_idx;
		}

		return true;
	}

	hasDoubleWell() {
		if (
			!this.tetris_top_row ||
			this.tetris_top_row.idx === 0 || // tetris ready all the way to the top
			this.tetris_top_row.well != 10
		)
			return false;

		for (let idx = this.tetris_top_row.idx; idx--; ) {
			let prev_row = this.rows[idx];

			if (prev_row.well === 10) continue; // tetris well still going!
			if (
				prev_row.emptys.length == 2 &&
				prev_row.emptys[0] === 8 &&
				prev_row.emptys[1] === 9
			) {
				return true;
			}

			return false;
		}

		return false;
	}
}
