// id to [address, num_bytes]
const gym6_data_maps = {
	score: [0x8, 4], // binScore
	level: [0x44, 1], // levelNumber
	lines: [0x50, 1], // lines
	field: [0x100, 200], // playfield

	gameMode: [0xc0, 1], // gameMode
	playState: [0x48, 1], // gameModeState
	completedRows: [0x4a, 4], // completedRow
	tetriminoX: [0x40, 1], // tetriminoX
	tetriminoY: [0x41, 1], // tetriminoY
	tetriminoOrientation: [0x42, 1], // currentPiece
	nextPieceOrientation: [0xbf, 1], // nextPiece

	frameCounter: [0xb1, 2], // frameCounter
	autoRepeatX: [0x46, 1], // autorepeatX

	stats: [0x3f0, 7 * 2], // statsByType
};

export const address_maps = {
	gym6: gym6_data_maps,
};
