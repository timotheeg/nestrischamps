const LIST = ['easiercap'];

async function getPalette(name) {
	const response = await fetch(`/ocr/palettes/${name}.json`);
	const json = await response.json();

	return json.map(([color1, color2]) => [
		new Uint8Array(color1),
		new Uint8Array(color2),
	]);
}

export default async function loadPalettes() {
	const palettes = {};

	try {
		palettes._saved = JSON.parse(localStorage.getItem('palette'));
	} catch (err) {}

	(await Promise.all(LIST.map(getPalette))).forEach((palette, idx) => {
		palettes[LIST[idx]] = palette;
	});

	return palettes;
}
