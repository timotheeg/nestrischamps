if (
	typeof CanvasRenderingContext2D !== 'undefined' &&
	!CanvasRenderingContext2D.prototype.clear
) {
	CanvasRenderingContext2D.prototype.clear = function (preserveTransform) {
		if (preserveTransform) {
			this.save();
			this.setTransform(1, 0, 0, 1, 0, 0);
		}

		this.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (preserveTransform) {
			this.restore();
		}
	};
}

export function noop() {}

export function getPercent(ratio) {
	const percent = Math.round(ratio * 100);

	return percent >= 100 ? '100' : percent.toString().padStart(2, '0') + '%';
}

export function css_size(css_pixel_width) {
	return parseInt(css_pixel_width.replace(/px$/, ''), 10);
}

export function peek(arr, offset = 0) {
	return arr[arr.length - (offset + 1)];
}

// see https://stackoverflow.com/a/12646864/361295
export function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}

	return array;
}

export function clamp(val, min, max) {
	if (val < min) return min;
	if (val > max) return max;
	return val;
}

export function translate(iRange, oRange, value) {
	// not adding validation of ranges and value... Assume callers have done it
	const ratio = (value - iRange[0]) / (iRange[1] - iRange[0]);
	return oRange[0] + ratio * (oRange[1] - oRange[0]);
}

export function readableScoreFomatter(score, space_pad = 0, zero_pad = 0) {
	if (isNaN(score)) score = 0;

	const is_negative = score < 0;

	score = `${Math.abs(score)}`.padStart(zero_pad, '0');

	let len = score.length;
	const parts = [];

	while (len) {
		const start = Math.max(0, len - 3);
		parts.unshift(score.slice(start, len));
		len = start;
	}

	return `${is_negative ? '-' : ''}${parts.join('\u202F')}`.padStart(
		space_pad,
		'\u00A0'
	); // narrow non-breakable space
}
