import { peek } from '/views/utils.js';

const CLEAR_ANIMATION_FRAMES = 7;

function fieldToBoard(field) {
	const rows = Array(20)
		.fill()
		.map((v, i) => field.slice(i * 10, i * 10 + 10));

	rows.num_block = field.reduce((acc, v) => (acc += v ? 1 : 0), 0);

	// console.log(rows.num_block);

	return rows;
}

function boardToField(board) {
	return [].concat(...board);
}

function isRowEmpty(row) {
	return 0 === row.reduce((sum, v) => sum + v, 0);
}

function isRowPotentiallyFirstFrameOfClearAnimation(row) {
	return (
		row[4] === 1 && row[5] === 1 && 2 === row.reduce((sum, v) => sum + v, 0)
	);
}

function isRowPotentiallySecondFrameOfDoubleClearAnimation(row) {
	return (
		row[3] === 1 &&
		row[4] === 1 &&
		row[5] === 1 &&
		row[6] === 1 &&
		4 === row.reduce((sum, v) => sum + v, 0)
	);
}

// detect first animation frame for singles, triples, tetris
function isFirstFrameOfClearAnimation(board) {
	if (
		board.num_block != 2 &&
		board.num_block != 4 &&
		board.num_block != 6 &&
		board.num_block != 8
	) {
		return false;
	}

	let row_indexes = [];

	for (let ridx = 0; ridx < 20; ridx++) {
		const row = board[ridx];

		if (isRowEmpty(row)) {
			continue;
		} else if (isRowPotentiallyFirstFrameOfClearAnimation(row)) {
			row_indexes.push(ridx);
		} else {
			return false;
		}
	}

	if (row_indexes.length === 2) {
		if (row_indexes[1] - row_indexes[0] === 1) {
			// not guaranteed to be a first frame of clear animation
			// it could also be an O piece
			return false;
		}
	}

	// K, here we know for sure we're in the first frame of a clear animation
	return true;
}

function isSecondFrameOfDoubleClearAnimation(board) {
	if (board.num_block != 8) {
		return false;
	}

	for (let ridx = 0; ridx < 19; ridx++) {
		const row = board[ridx];

		if (isRowEmpty(row)) {
			continue;
		} else if (isRowPotentiallySecondFrameOfDoubleClearAnimation(row)) {
			return isRowPotentiallySecondFrameOfDoubleClearAnimation(board[++ridx]);
		}

		break;
	}

	return false;
}

// mixin pseudo methods below
// they will be invoke with .call(), so we cn use this to indicate we handle the player object

function init() {
	this.invisible_frame_buffer = [];
	this.combined_board;
	this.cur_board;
	this.last_field_str;
	this.game_id;
	this.top_empty;
	this.clear_animation_remaining_frames;
	this.clear_animation_covered;
	this.clearedRowsIndexes = [];

	reset.call(this);
}

function reset() {
	this.combined_board = Array(20)
		.fill()
		.map(_ => Array(10).fill(0));
	this.invisible_frame_buffer.length = 0;
	this.last_field_str = '';
	this.top_empty = true;
	this.clear_animation_remaining_frames = 0;
	this.clearedRowsIndexes.length = 0;
}

function startClearAnimation(remaining_frames, board) {
	this.clear_animation_remaining_frames = remaining_frames;
	this.clear_animation_covered = false;

	this.clearedRowsIndexes.length = 0;

	board.forEach((row, idx) => {
		if (row.some(cell => cell > 0)) {
			this.clearedRowsIndexes.push(idx);
		}
	});
}

function setFrame(frame) {
	if (frame.gameid !== this.game_id) {
		this.game_id = frame.gameid;
		reset.call(this);
	}

	const last_board = peek(this.invisible_frame_buffer)?._board;

	const field_str = frame.field.join('');

	if (this.last_field_str === field_str) {
		if (this.invisible_frame_buffer.length <= 0) return;

		this.invisible_frame_buffer.push({
			...frame,
			field: peek(this.invisible_frame_buffer).field,
			_board: peek(this.invisible_frame_buffer)._board,
		});
	} else {
		this.last_field_str = field_str;

		let new_board = fieldToBoard(frame.field);

		frame._board = new_board;

		if (this.clear_animation_remaining_frames-- > 0) {
			new_board._clear = true;

			if (
				this.clear_animation_covered ||
				this.clear_animation_remaining_frames <= 0
			) {
				// last frame of clear animation, we need to remove all empty lines
				// MUST RUN BEFORE NEXT PIECE APPEARS!!!!

				let empty_rows, filled_rows;

				if (this.clear_animation_covered) {
					empty_rows = this.combined_board.filter(row =>
						row.every(cell => cell === 0)
					);
					filled_rows = this.combined_board.filter(row =>
						row.some(cell => cell > 0)
					);
				} else {
					empty_rows = this.clearedRowsIndexes.map(_ => Array(10).fill(0));
					filled_rows = this.combined_board.filter(
						(row, idx) => !this.clearedRowsIndexes.includes(idx)
					);
				}

				this.combined_board = [...empty_rows, ...filled_rows];
			} else {
				if (new_board.num_block < 200) {
					// 200 is a flash, it means we're OCR-ing Trey's renderer
					new_board.forEach((row, ridx) =>
						row.forEach((cell, cidx) => {
							if (cell === 1) {
								this.combined_board[ridx][cidx] = 0;
							}
						})
					);
				}
			}

			if (
				new_board.num_block &&
				new_board.num_block < 200 &&
				new_board.num_block % 10 === 0
			) {
				// this is the frame where the line clear cover the entire horizontal breadth of the field
				this.clear_animation_covered = 1;

				// We force the remaining frames to 1, just in case
				// Ensures we won't run the drop action twice
				this.clear_animation_remaining_frames = 1;
			}

			this.cur_board = this.combined_board;
		} else if (new_board.num_block === 0) {
			return; // ignore blank frames
		} else if (new_board.num_block === 200) {
			if (!last_board) return; // renderer starts on curtain

			// end frame of death animation
			// OR
			// tetris animation in field in Trey's renderer
			startClearAnimation.call(this, 10, new_board);

			new_board._clear = true;

			// record prev piece settling
			last_board.forEach((row, ridx) =>
				row.forEach((cell, cidx) => {
					if (cell === 0) return;

					this.combined_board[ridx][cidx] = cell + 3;
				})
			);

			this.cur_board = this.combined_board;
		} else if (isFirstFrameOfClearAnimation(new_board)) {
			// preparing clear animation
			startClearAnimation.call(this, CLEAR_ANIMATION_FRAMES - 1, new_board);

			new_board._clear = true;

			// record prev piece settling
			last_board.forEach((row, ridx) =>
				row.forEach((cell, cidx) => {
					if (cell === 0) return;

					this.combined_board[ridx][cidx] = cell + 3;
				})
			);

			// remove the block from the clear animation
			new_board.forEach((row, ridx) =>
				row.forEach((cell, cidx) => {
					if (cell === 1) {
						this.combined_board[ridx][cidx] = 0;
					}
				})
			);

			this.cur_board = this.combined_board;
		} else if (isSecondFrameOfDoubleClearAnimation(new_board)) {
			// preparing clear animation
			startClearAnimation.call(this, CLEAR_ANIMATION_FRAMES - 2, new_board);

			// we now need to correct the previous frame

			new_board._clear = true;
			last_board._clear = true;

			const last_combined_board = peek(
				this.invisible_frame_buffer
			)._combined_board;

			// 1. record prev piece settling
			peek(this.invisible_frame_buffer, 1)._board.forEach((row, ridx) =>
				row.forEach((cell, cidx) => {
					if (cell === 0) return;

					last_combined_board[ridx][cidx] = cell + 3;
				})
			);

			// 2. remove "O piece hole" (it was part of the clear animation after all)
			last_board.forEach((row, ridx) =>
				row.forEach((cell, cidx) => {
					if (cell === 1) {
						last_combined_board[ridx][cidx] = 0;
					}
				})
			);

			// 3. update past frame object
			peek(this.invisible_frame_buffer).field =
				boardToField(last_combined_board);

			// 4. update new combined board
			this.combined_board = last_combined_board;

			// 5. and clear the blocks from the second frame of animation too
			new_board.forEach((row, ridx) =>
				row.forEach((cell, cidx) => {
					if (cell === 1) {
						this.combined_board[ridx][cidx] = 0;
					}
				})
			);

			this.cur_board = this.combined_board;
		} else {
			// piece is falling, we need to display its temporary location
			const new_top_empty =
				new_board.slice(0, 2).filter(row => row.every(cell => cell === 0))
					.length === 2;

			if (!new_top_empty && last_board && last_board.num_block == 4) {
				// we only settle pieces, not animation frames
				// check if last_board's piece was below 16
				let last_top_idx = last_board
					.map((row, idx) => (row.some(cell => cell > 0) ? idx : -1))
					.find(v => v > -1);

				if (last_top_idx > 3) {
					// TODO: Find a better way to do this detection
					// as it is, we do not record piece settling high, even if they are on the side, when we could actually detect them
					// record prev piece settling
					last_board.forEach((row, ridx) =>
						row.forEach((cell, cidx) => {
							if (cell === 0) return;

							this.combined_board[ridx][cidx] = cell + 3;
						})
					);
				}
			}

			this.cur_board = this.combined_board.map((row, ridx) =>
				[...row].map((cell, cidx) => {
					return new_board[ridx][cidx] || cell;
				})
			);
		}

		this.invisible_frame_buffer.push({
			...frame,
			field: boardToField(this.cur_board),
			_combined_board: this.cur_board,
		});
	}

	if (this.invisible_frame_buffer.length >= 3) {
		this._setFrame(this.invisible_frame_buffer.shift());
	}
}

export default function InvisibleMixin(player) {
	init.call(player);
	player._setFrame = player.setFrame;
	player.setFrame = setFrame;
}
