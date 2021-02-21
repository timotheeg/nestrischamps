const width = 1280;
const height = 720;

const border = 100;

const grid_x = 8;
const grid_y = 5;

const span_x = (width - border * 2) / (grid_x - 1);
const span_y = (height - border * 2) / (grid_y - 1);

const spread = 1/3;

const pieces = [];

let num_bags = Math.ceil(grid_x * grid_y / PIECES.length);

while(num_bags--) {
	pieces.push(...shuffle(PIECES.concat()));
}

const bg = document.querySelector('#bg_pieces');


for (let x = grid_x; x--; ) {
	for (let y = grid_y; y--; ) {
		const piece = pieces.pop();
		const img = new Image()

		img.src = `./bg_pieces/${piece}.png`;

		const pos_x = Math.round(border / 2 + span_x * (x - spread + 2 * spread * Math.random()));
		const pos_y = Math.round(border + span_y * (y - spread + 2 * spread * Math.random()));

		Object.assign(img.style, {
			left:            `${pos_x}px`,
			top:             `${pos_y}px`,
			position:        'absolute',
			transform:       `rotate(${90 * Math.floor(Math.random() * 4)}deg)`,
			transformOrigin: '50% 50%',
		});

		bg.appendChild(img);
	}
}
