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
	const palettes = (await Promise.all(LIST.map(getPalette))).reduce(
		(acc, palette, idx) => {
			acc[LIST[idx]] = palette;
			return acc;
		},
		{}
	);

	try {
		palettes._saved = JSON.parse(localStorage.getItem('palette'));
	} catch (err) {}

	return palettes;
}
