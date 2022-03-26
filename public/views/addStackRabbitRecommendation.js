// represent the spawn point at top of screen
const OFFSET_X = 3;
const OFFSET_Y = -2;

const ROTATIONS = {
	T: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 4, 4, 4],
			[0, 0, 4, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 4, 0],
			[0, 4, 4, 0],
			[0, 0, 4, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 4, 0],
			[0, 4, 4, 4],
			[0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 4, 0],
			[0, 0, 4, 4],
			[0, 0, 4, 0],
		],
	],
	J: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 5, 5, 5],
			[0, 0, 0, 5],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 5, 0],
			[0, 0, 5, 0],
			[0, 5, 5, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 5, 0, 0],
			[0, 5, 5, 5],
			[0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 5, 5],
			[0, 0, 5, 0],
			[0, 0, 5, 0],
		],
	],
	Z: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 6, 6, 0],
			[0, 0, 6, 6],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 6, 0],
			[0, 6, 6, 0],
			[0, 6, 0, 0],
		],
	],
	O: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 4, 4, 0],
			[0, 4, 4, 0],
		],
	],
	S: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 5, 5],
			[0, 5, 5, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 5, 0, 0],
			[0, 5, 5, 0],
			[0, 0, 5, 0],
		],
	],
	L: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 6, 6, 6],
			[0, 6, 0, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 6, 6, 0],
			[0, 0, 6, 0],
			[0, 0, 6, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 0, 6],
			[0, 6, 6, 6],
			[0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0],
			[0, 0, 6, 0],
			[0, 0, 6, 0],
			[0, 0, 6, 6],
		],
	],
	I: [
		[
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[4, 4, 4, 4],
			[0, 0, 0, 0],
		],
		[
			[0, 0, 4, 0],
			[0, 0, 4, 0],
			[0, 0, 4, 0],
			[0, 0, 4, 0],
		],
	],
};

// from stack rabbit evaluation, compute where the piece's final position is
export default function addStackRabbitRecommendation(field, piece, placement) {
	const [rotation, xshift, yshift] = placement;
	const field_copy = [...field];
	const shape = ROTATIONS[piece][rotation];
	const offset_x = OFFSET_X + xshift;
	const offset_y = OFFSET_Y + yshift;

	// put piece in field, warn if error (piece taking non-empty space)

	for (let x = 0; x < 4; x++) {
		for (let y = 0; y < 4; y++) {
			const block = shape[y][x];
			if (!block) continue;
			const target_x = offset_x + x;
			if (target_x < 0 || target_x >= 10) continue;
			const target_y = offset_y + y;
			if (target_y < 0 || target_y >= 19) continue;

			const target_idx = target_y * 10 + target_x;

			if (field_copy[target_idx]) {
				console.warn(
					`Stack Rabbit pLacement collides with board block at ${target_x}x${target_y}`
				);
			}

			field_copy[target_idx] = block;
		}
	}

	return field_copy;
}
