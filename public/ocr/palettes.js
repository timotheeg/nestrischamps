const LIST = [
	'easiercap'
];

async function getPalette(name) {
	const response = await fetch(`/ocr/palettes/${name}.json`);
	const json = await response.json();

	return json.map(([color1, color2]) => [new Uint8Array(color1), new Uint8Array(color2)]);
}

async function loadPalettes() {
	return (await Promise.all(LIST.map(getPalette)))
		.reduce((acc, palette, idx) => {
			acc[LIST[idx]] = palette;
			return acc;
		}, {});
}