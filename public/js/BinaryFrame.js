const BinaryFrame = (function() {

const FORMAT_VERSION = 1;

const FRAME_SIZE_BY_VERSION = {
	'1': 72,
};

const GAME_TYPE = {
	CLASSIC: 1,
	DAS_TRAINER: 2,
};

const PIECE_TO_VALUE = {
	T: 0,
	J: 1,
	Z: 2,
	O: 3,
	S: 4,
	L: 5,
	I: 6,
};

const VALUE_TO_PIECE = {
	0: 'T',
	1: 'J',
	2: 'Z',
	3: 'O',
	4: 'S',
	5: 'L',
	6: 'I',
};

const PIECES = Object.keys(PIECE_TO_VALUE);

const NULLABLE_FIELDS = [
	'score',
	'lines',
	'level',
	'instant_das',
	'cur_piece_das',
	...PIECES
];


class BinaryFrame {
	static encode(pojo) {
		// TODO: validate pojo fields
		// TODO: throw if values are not compatible with format

		// sanitize values to represent null
		const sanitized = { ...pojo };

		NULLABLE_FIELDS.forEach(field => {
			// capture null and undefined on purpose
			if (sanitized[field] == null) {
				sanitized[field] = 0xFFFFFFFF;
			}
		});

		if (sanitized.preview == null) {
			sanitized.preview = 0xFFFFFFFF;
		}
		else {
			sanitized.preview = PIECE_TO_VALUE[sanitized.preview]
		}

		if (sanitized.cur_piece == null) {
			sanitized.cur_piece = 0xFFFFFFFF;
		}
		else {
			sanitized.cur_piece = PIECE_TO_VALUE[sanitized.cur_piece]
		}

		if (sanitized.field == null) {
			sanitized.field = Array(200).fill(0);
		}

		// fields are now clean, encode!

		const buffer = new Uint8Array(FRAME_SIZE_BY_VERSION[FORMAT_VERSION]);

		let bidx = 0; // byte index

		// header
		buffer[bidx++] = (
			((FORMAT_VERSION & 0b111) << 5)
			|
			((sanitized.game_type & 0b11) << 3)
		);

		// gameid
		buffer[bidx++] = (sanitized.gameid & 0xFF00) >> 8;
		buffer[bidx++] = (sanitized.gameid & 0x00FF) >> 0;

		// ctime
		buffer[bidx++] = (sanitized.ctime & 0xFF000000) >> 24;
		buffer[bidx++] = (sanitized.ctime & 0x00FF0000) >> 16;
		buffer[bidx++] = (sanitized.ctime & 0x0000FF00) >>  8;
		buffer[bidx++] = (sanitized.ctime & 0x000000FF) >>  0;

		// score
		buffer[bidx++] = (sanitized.score & 0xFF0000) >> 16;
		buffer[bidx++] = (sanitized.score & 0x00FF00) >>  8;
		buffer[bidx++] = (sanitized.score & 0x0000FF) >>  0;

		// lines + level
		buffer[bidx++] = (sanitized.lines & 0b111111110) >> 1;
		buffer[bidx++] = (
			((sanitized.lines & 0b1) << 7)
			|
			(sanitized.level & 0b1111111)
		);

		// instant_das + preview
		buffer[bidx++] = (
			(((sanitized.instant_das) & 0b11111) << 3)
			|
			(sanitized.preview & 0b111)
		);

		// cur piece das + cur piece
		buffer[bidx++] = (
			((sanitized.cur_piece_das & 0b11111) << 3)
			|
			(sanitized.cur_piece & 0b111)
		);

		// piece stats
		buffer[bidx++] = sanitized.T;
		buffer[bidx++] = sanitized.J;
		buffer[bidx++] = sanitized.Z;
		buffer[bidx++] = sanitized.O;
		buffer[bidx++] = sanitized.S;
		buffer[bidx++] = sanitized.L;
		buffer[bidx++] = sanitized.I;

		// field
		for (let block_idx = 0; block_idx < sanitized.field.length; block_idx += 4) {
			buffer[bidx++] = (
				((sanitized.field[block_idx + 0] & 0b11) << 6)
				|
				((sanitized.field[block_idx + 1] & 0b11) << 4)
				|
				((sanitized.field[block_idx + 2] & 0b11) << 2)
				|
				((sanitized.field[block_idx + 3] & 0b11) << 0)
			);
		}

		return buffer;
	}

	static parse(buffer) {
		const pojo = {};

		const f = new Uint8Array(buffer);

		if (f[0] >> 5 != FORMAT_VERSION) {
			throw new Error('Version not supported');
		}

		let bidx = 0;

		pojo.game_type = (f[bidx] & 0b11000) >> 3;
		pojo.player_num = (f[bidx++] & 0b111);

		pojo.gameid = (f[bidx++] << 8) | f[bidx++];

		pojo.ctime = (f[bidx++] << 24) | (f[bidx++] << 16) | (f[bidx++] << 8) | f[bidx++];

		pojo.score = (f[bidx++] << 16) | (f[bidx++] << 8) | f[bidx++];

		pojo.lines = (f[bidx++] << 1) | ((f[bidx] & 0b10000000) >> 7);
		pojo.level = f[bidx++] & 0b1111111;

		pojo.instant_das = (f[bidx] & 0b11111000) >> 3;
		pojo.preview = f[bidx++] & 0b111;

		pojo.cur_piece_das = (f[bidx] & 0b11111000) >> 3;
		pojo.cur_piece = f[bidx++] & 0b111;

		// piece stats
		pojo.T = buffer[bidx++];
		pojo.J = buffer[bidx++];
		pojo.Z = buffer[bidx++];
		pojo.O = buffer[bidx++];
		pojo.S = buffer[bidx++];
		pojo.L = buffer[bidx++];
		pojo.I = buffer[bidx++];

		pojo.field = Array(200);

		for (let idx=0; idx < 50; idx++) {
			pojo.field[idx * 4 + 0] = (f[bidx  ] & 0b11000000) >> 6;
			pojo.field[idx * 4 + 1] = (f[bidx  ] & 0b00110000) >> 4;
			pojo.field[idx * 4 + 2] = (f[bidx  ] & 0b00001100) >> 2;
			pojo.field[idx * 4 + 3] = (f[bidx++] & 0b00000011) >> 0;
		}

		// we've extracted all the value, now checks for nulls

		if (pojo.score === 0xFFFFFF) pojo.score = null;
		if (pojo.lines === 0b111111111) pojo.lines = null;
		if (pojo.level === 0b1111111) pojo.level = null;
		if (pojo.instant_das === 0b11111) pojo.instant_das = null;
		if (pojo.cur_piece_das === 0b11111) pojo.cur_piece_das = null;

		PIECES.forEach(piece => {
			if (pojo[piece] === 0xFF) {
				pojo[piece] = null;
			}
		});

		if (pojo.preview === 0b111) {
			pojo.preview = null;
		}
		else {
			pojo.preview = VALUE_TO_PIECE[pojo.preview];
		}

		if (pojo.cur_piece === 0b111) {
			pojo.cur_piece = null;
		}
		else {
			pojo.cur_piece = VALUE_TO_PIECE[pojo.cur_piece];
		}

		return pojo;
	}
}

BinaryFrame.GAME_TYPE = GAME_TYPE;

return BinaryFrame;

})();
