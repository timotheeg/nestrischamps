class Row {
	constructor(cells, row_idx) {
		this.cells = cells;
		this.idx = row_idx;
		this.emptys = [];

		this.cells.forEach((val, idx) => {
			if (!val) emptys.push(idx);
		});

		if (this.emptys.length === 1) {
			this.well = this.emptys[0];
		}
	}

	isEmpty() {
		return this.emptys.length >= 10;
	}

	hasWell() {
		return this.well !== undefined;
	}
}

class Column {
	constructor(cells, col_idx) {
		this.cells = cells;
		this.idx = col_idx;

		this.top_fill_idx = this.cells.findIndex(cell => cell); // return index of first non-empty cell

		if (this.top_fill_idx <= -1) {
			this.top_fill_idx = this.cells.length;
		}

		this.has_holes = this.cells.indexOf(0, this.top_fill_idx) > -1;
	}
}

export default class Board {
	constructor(field) {
		this.rows = Array();

		const columns = Array(10)
			.fill()
			.map(_ => []);

		let top_seen = false;
		let top_idx = 2;

		for (let yidx = 20; yidx--; ) {
			let row;

			if (!top_seen) {
				row = new Row(
					field.slice(10 * yidx, 10 * yidx + 10),
					20 - this.rows.length
				);

				if (row.isEmpty()) {
					top_seen = true;
					top_idx = yidx + 1;
				}
			} else {
				// removes falling piece
				row = new Row([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], this.rows.length);
			}

			this.rows.unshift(row);

			row.cells.forEach((value, idx) => {
				columns[idx].unshift(value);
			});
		}

		this.columns = columns.map((cells, idx) => new Column(cells, idx));

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
			// we check against 4 because for each row, we inspect the 3 rows below
			const row = this.rows[idx];

			if (!row.hasWell()) continue;

			// blocked below and free above
			if (this.columns[row.well].top_fill_idx !== idx + 1) continue;

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
			this.tetris_top_row.well != 9
		)
			return false;

		for (let idx = this.tetris_top_row.idx; idx--; ) {
			let prev_row = this.rows[idx];

			if (prev_row.well === 9) continue; // tetris well still going!
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
