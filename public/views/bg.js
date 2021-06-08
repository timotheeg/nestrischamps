(function () {
	if (QueryString.bg === '0') {
		return;
	}

	if (QueryString.bg === '2' || QueryString.bg === '3') {
		const img_width = 218;
		const bg_file =
			QueryString.bg === '2'
				? 'nestrischamps_bg_green.png'
				: 'nestrischamps_bg.png';
		const bg = document.createElement('div');

		bg.classList.add('bg');

		Object.assign(bg.style, {
			position: 'absolute',
			width: '140%',
			height: '140%',
			top: '-20%',
			left: '-20%',
			background: `url(/views/${bg_file}) 0 0 repeat`,
			transform: 'rotate(-11deg)',
		});

		let pos = 0;

		setInterval(() => {
			pos = ++pos % img_width;
			bg.style.backgroundPositionX = `${pos}px`;
		}, 1000 / 30);

		document.querySelector('#stream_bg').prepend(bg);

		return;
	}

	// bg=1 (default pieces)
	const width = 1280;
	const height = 720;

	const border = 100;

	const grid_x = 8;
	const grid_y = 5;

	const span_x = (width - border * 2) / (grid_x - 1);
	const span_y = (height - border * 2) / (grid_y - 1);

	const spread = 1 / 3;

	const pieces = [];

	let num_bags = Math.ceil((grid_x * grid_y) / PIECES.length);

	while (num_bags--) {
		pieces.push(...shuffle(PIECES.concat()));
	}

	const bg = document.createElement('div');

	bg.classList.add('bg');

	for (let x = grid_x; x--; ) {
		for (let y = grid_y; y--; ) {
			const piece = pieces.pop();
			const img = new Image();

			img.src = `/views/bg_pieces/${piece}.png`;

			const pos_x = Math.round(
				border / 2 + span_x * (x - spread + 2 * spread * Math.random())
			);
			const pos_y = Math.round(
				border + span_y * (y - spread + 2 * spread * Math.random())
			);

			Object.assign(img.style, {
				left: `${pos_x}px`,
				top: `${pos_y}px`,
				position: 'absolute',
				transform: `rotate(${90 * Math.floor(Math.random() * 4)}deg)`,
			});

			bg.appendChild(img);
		}
	}

	const parent = document.querySelector('#stream_bg');

	parent.style.backgroundColor = 'black';

	parent.prepend(bg);
})();
