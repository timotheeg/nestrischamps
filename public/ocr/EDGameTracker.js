// Transform raw game data into NTC frame format
const TILE_ID_TO_NTC_BLOCK_ID = new Map([
	[0xef, 0],
	[0x7b, 1],
	[0x7d, 2],
	[0x7c, 3],
]);

const PIECE_ORIENTATION_TO_PIECE = [
	'T',
	'T',
	'T',
	'T',
	'J',
	'J',
	'J',
	'J',
	'Z',
	'Z',
	'O',
	'S',
	'S',
	'L',
	'L',
	'L',
	'L',
	'I',
	'I',
];

// prettier-ignore
const PIECE_ORIENTATION_TO_BLOCK_POSITIONS = [
    [[-1, 0], [0, 0], [1, 0], [0, -1]],  // T up
    [[0, -1], [0, 0], [1, 0], [0, 1]],  // T right
    [[-1, 0], [0, 0], [1, 0], [0, 1]],  // T down (spawn)
    [[0, -1], [-1, 0], [0, 0], [0, 1]],  // T left
    [[0, -1], [0, 0], [-1, 1], [0, 1]],  // J left
    [[-1, -1], [-1, 0], [0, 0], [1, 0]],  // J up
    [[0, -1], [1, -1], [0, 0], [0, 1]],  // J right
    [[-1, 0], [0, 0], [1, 0], [1, 1]],  // J down (spawn)
    [[-1, 0], [0, 0], [0, 1], [1, 1]],  // Z horizontal (spawn)
    [[1, -1], [0, 0], [1, 0], [0, 1]],  // Z vertical
    [[-1, 0], [0, 0], [-1, 1], [0, 1]],  // O (spawn)
    [[0, 0], [1, 0], [-1, 1], [0, 1]],  // S horizontal (spawn)
    [[0, -1], [0, 0], [1, 0], [1, 1]],  // S vertical
    [[0, -1], [0, 0], [0, 1], [1, 1]],  // L right
    [[-1, 0], [0, 0], [1, 0], [-1, 1]],  // L down (spawn)
    [[-1, -1], [0, -1], [0, 0], [0, 1]],  // L left
    [[1, -1], [-1, 0], [0, 0], [1, 0]],  // L up
    [[0, -2], [0, -1], [0, 0], [0, 1]],  // I vertical
    [[-2, 0], [-1, 0], [0, 0], [1, 0]],  // I horizontal (spawn)
];

// prettier-ignore
const PIECE_ORIENTATION_TO_NTC_BLOCK_COLOR = [
    1, 1, 1, 1, // T
    2, 2, 2, 2, // J
    3, 3, // Z
    1, // O
    2, 2, // S
    3, 3, 3, 3, // L
    1, 1 // I
];

export default class EDGameTracker {
	constructor() {
		this.gameid = 0;
		this.startTime = Date.now();
		this.pieceSpawnDas = 16;
		this.previousFieldData = null;

		this.maxFrameTimeDiff = 0;

		// bound methods
		this.setData = this.setData.bind(this);
	}

	_bcdToDecimal(byte1, byte2) {
		return byte2 * 100 + (byte1 >> 4) * 10 + (byte1 & 0xf);
	}

	// update field in place
	_embedCurrentPiece(field, x, y, orientationId) {
		const blockColor = PIECE_ORIENTATION_TO_NTC_BLOCK_COLOR[orientationId];

		if (!blockColor) return;

		PIECE_ORIENTATION_TO_BLOCK_POSITIONS[orientationId].forEach(
			([offsetX, offsetY]) => {
				const index = (y + offsetY) * 10 + x + offsetX;
				if (index < 0 || index >= 200) return;
				field[index] = blockColor;
			}
		);
	}

	// update field in place
	_setClearAnimation(field, clearX, completedRows) {
		completedRows.forEach(rowIdx => {
			if (!rowIdx) return;

			// clear blocks by symmetry from the center
			const rowOffset = rowIdx * 10;
			for (let offsetX = clearX + 1; offsetX--; ) {
				field[rowOffset + 4 - offsetX] = 0; // clear left
				field[rowOffset + 5 + offsetX] = 0; // clear right
			}
		});
	}

	// return copy of the field array with current piece embedded and clear animation played
	_updateField(fieldData) {
		// playState:
		// 1 - process piece movements
		// 2 - lock tetrimino
		// 3 - check for rows
		// 4 - line clear animation
		// 5 - calculate score
		// 6 - b type goal check
		// 7 - process garbage
		// 8 - spawn next tetrimino

		// always make a copy
		const newField = fieldData.field
			.slice()
			.map(tile_id => TILE_ID_TO_NTC_BLOCK_ID.get(tile_id) ?? 0);

		if (fieldData.playState === 1 || fieldData.playState === 8) {
			this._embedCurrentPiece(
				newField,
				fieldData.tetriminoX,
				fieldData.tetriminoY,
				fieldData.tetriminoOrientation
			);
		} else if (fieldData.playState === 4) {
			// can potentially ignore this if (frameCounter & 3), but very little cost in repeating the operation
			this._setClearAnimation(
				newField,
				fieldData.completedRowXClear,
				fieldData.completedRows
			);
		}

		return newField;
	}

	setData(frameBuffer) {
		performance.mark('extract_data_start');

		const ctime = Date.now() - this.startTime; // record ctime as early as possible

		const [
			gameMode, // 0
			playState,
			completedRowXClear,
			completedRow0,
			completedRow1,
			completedRow2,
			completedRow3,
			lines0,
			lines1,
			level,
			score0, // 10
			score1,
			score2,
			score3,
			nextPieceOrientation,
			tetriminoOrientation,
			tetriminoX,
			tetriminoY,
			frameCounter0,
			frameCounter1,
			autoRepeatX, // 20
			statsT0,
			statsT1,
			statsJ0,
			statsJ1,
			statsZ0,
			statsZ1,
			statsO0,
			statsO1,
			statsS0,
			statsS1, // 30
			statsL0,
			statsL1,
			statsI0,
			statsI1,
			...field // includes the tail
		] = frameBuffer;

		field.length = 200; // drops the tail

		const frameCounter = (frameCounter1 << 8) | frameCounter0;
		const fieldUpdateData = {
			gameMode,
			ctime,
			playState,
			frameCounter,
			completedRowXClear,
			completedRows: [
				completedRow0,
				completedRow1,
				completedRow2,
				completedRow3,
			],
			tetriminoX,
			tetriminoY,
			tetriminoOrientation,
			field,
		};

		const ntcField = this._updateField(fieldUpdateData);

		if (!this.previousFieldData || this.previousFieldData.gameMode != 4) {
			// is wrong!
			// need better understanding of game starting!
			this.gameid += 1;
		}

		if (playState === 8) {
			// piece spawn, record das value
			this.pieceSpawnDas = autoRepeatX;
		}

		if (this.previousFieldData) {
			if (frameCounter - this.previousFieldData.frameCounter !== 1) {
				console.warn(
					`Dropped frames: ${this.previousFieldData.frameCounter} -> frameCounter`
				);
			}

			const timeDiff = ctime - this.previousFieldData.ctime;
			if (timeDiff > this.maxFrameTimeDiff) {
				this.maxFrameTimeDiff = timeDiff;
			}
		}

		const ntcFrameData = {
			// classic data
			game_type: BinaryFrame.GAME_TYPE.CLASSIC,
			gameid: this.gameid,
			ctime,
			lines: this._bcdToDecimal(lines0, lines1),
			level,
			score: (score3 << 24) | (score2 << 16) | (score1 << 8) | score0,
			T: this._bcdToDecimal(statsT0, statsT1),
			J: this._bcdToDecimal(statsJ0, statsJ1),
			Z: this._bcdToDecimal(statsZ0, statsZ1),
			O: this._bcdToDecimal(statsO0, statsO1),
			S: this._bcdToDecimal(statsS0, statsS1),
			L: this._bcdToDecimal(statsL0, statsL1),
			I: this._bcdToDecimal(statsI0, statsI1),
			preview: PIECE_ORIENTATION_TO_PIECE[nextPieceOrientation],
			field: ntcField,

			// das trainer data - should probably not report... might confuse views 😰
			cur_piece: PIECE_ORIENTATION_TO_PIECE[tetriminoOrientation],
			cur_piece_das: this.pieceSpawnDas,
			instant_das: autoRepeatX,

			// non NTC frame fields, but returned for informational display
			gameMode,
			playState,
			frameCounter,
			completedRowXClear,
			completedRow0,
			completedRow1,
			completedRow2,
			completedRow3,
			tetriminoX,
			tetriminoY,
			tetriminoOrientation,
			nextPieceOrientation,
			maxFrameTimeDiff: this.maxFrameTimeDiff,
		};

		// Adjust the frame data if needed to accout for pause, menu, etc...
		if (gameMode != 4) {
			Object.assign(ntcFrameData, {
				lines: null,
				_lines: ntcFrameData.lines,
				level: null,
				_level: ntcFrameData.level,
				score: null,
				_score: ntcFrameData.score,
				preview: null,
				_preview: ntcFrameData.score,
			});
		}

		this.previousFieldData = fieldUpdateData;

		performance.mark('extract_data_end');

		this.onFrame(ntcFrameData);
	}

	// default callback
	// Caller to overwrite
	onFrame() {}
}