const DIGITS = "0123456789ABCDEF".split('');

DIGITS.unshift('null');

async function getTemplateData(digit) {
	const response = await fetch(`/ocr/${digit.toLowerCase()}.png`);
	const blob = await response.blob();

	return await createImageBitmap(blob);
}

async function loadDigitTemplates() {
	const imgs = await Promise.all(DIGITS.map(getTemplateData));

	// we write all the templates in a row in a canva with 1px spacing in between
	// we scaled uniformly
	// we crop the scaled digits from their expected new location

	const width = DIGITS.length * 8 + 1;
	const height = 7;
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');

	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#000000FF';
	ctx.fillRect(0, 0, width, height);

	// draw all templates with one pixel border on each side
	imgs.forEach((img, idx) => ctx.drawImage(img, 1 + idx * 8, 0));

	const source = ctx.getImageData(0, 0, width, height);
	const scaled = new ImageData(width * 2, height * 2);

	bicubic(source, scaled);

	return imgs.map((_, idx) => {
		const digit = crop(scaled, 2 + idx * 16, 0, 14, 14);

		// and now we compute the luma for the digit
		const lumas = new Float64Array(14 * 14);
		const pixel_data = digit.data;

		for (let idx=0; idx<lumas.length; idx++) {
			const offset_idx = idx << 2;

			lumas[idx] = luma(
				pixel_data[offset_idx],
				pixel_data[offset_idx + 1],
				pixel_data[offset_idx + 2],
			);
		}

		return lumas;
	});
}