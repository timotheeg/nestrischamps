function renderBlock(
	level,
	block_index,
	pixel_size,
	ctx,
	pos_x,
	pos_y,
	print_black_border
) {
	let color;

	if (block_index < 1) {
		return;
	}

	switch (block_index) {
		case 1:
			// maybe inefficient because it draws the area twice
			// but drawing the zones will bemore function calls
			// hmmm... check speed and optimize if necessary
			color = LEVEL_COLORS[level % 10][0];

			ctx.fillStyle = color;
			ctx.fillRect(pos_x, pos_y, pixel_size * 7, pixel_size * 7);

			/*
			// Drawing just the needed border
			ctx.fillRect(
				pos_x,
				pos_y + pixel_size,
				pixel_size,
				pixel_size * 6
			);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y,
				pixel_size * 6,
				pixel_size
			);
			ctx.fillRect(
				pos_x + pixel_size * 6,
				pos_y + pixel_size,
				pixel_size,
				pixel_size * 6
			);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size * 6,
				pixel_size * 5,
				pixel_size
			);
			/**/

			ctx.fillStyle = 'white';
			ctx.fillRect(pos_x, pos_y, pixel_size, pixel_size);

			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size,
				pixel_size * 5,
				pixel_size * 5
			);

			break;

		case 2:
		case 3:
			color = LEVEL_COLORS[level % 10][block_index - 2];

			ctx.fillStyle = color;
			ctx.fillRect(pos_x, pos_y, pixel_size * 7, pixel_size * 7);

			ctx.fillStyle = 'white';
			ctx.fillRect(pos_x, pos_y, pixel_size, pixel_size);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size,
				pixel_size * 2,
				pixel_size
			);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size * 2,
				pixel_size,
				pixel_size
			);

			break;

		case 4:
		case 5:
		case 6:
			if (block_index === 4) {
				color = '#FFFFFF';
			} else {
				color = LEVEL_COLORS[level % 10][block_index - 5];
			}

			ctx.fillStyle = `${color}90`;
			ctx.fillRect(pos_x, pos_y, pixel_size * 7, pixel_size);
			ctx.fillRect(pos_x, pos_y + pixel_size, pixel_size, pixel_size * 6);
			ctx.fillRect(
				pos_x + pixel_size * 6,
				pos_y + pixel_size,
				pixel_size,
				pixel_size * 6
			);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size * 6,
				pixel_size * 5,
				pixel_size
			);

			break;
	}

	if (print_black_border) {
		ctx.fillStyle = 'black';
		ctx.fillRect(pos_x, pos_y + pixel_size * 7, pixel_size * 7, pixel_size);
		ctx.fillRect(pos_x + pixel_size * 7, pos_y, pixel_size, pixel_size * 8);
	}
}
