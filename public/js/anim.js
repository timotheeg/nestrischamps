// Penner easing
// http://robertpenner.com/easing/

export function linear(t, b, c, d) {
	return b + (c * t) / d;
}

export function easeOutQuart(t, b, c, d) {
	return -c * ((t = t / d - 1) * t * t * t - 1) + b;
}

export function easeOutQuad(t, b, c, d) {
	return -c * (t /= d) * (t - 2) + b;
}

export function easeInQuad(t, b, c, d) {
	return c * (t /= d) * t + b;
}

export function easeInQuint(t, b, c, d) {
	return c * (t /= d) * t * t * t * t + b;
}

export function easeInOutBack(t, b, c, d, s) {
	if (s == undefined) s = 1.70158;
	if ((t /= d / 2) < 1)
		return (c / 2) * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
	return (c / 2) * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
}

export function easeOutElastic(t, b, c, d) {
	let s = 1.70158;
	let p = 0;
	let a = c;

	if (t == 0) return b;
	if ((t /= d) >= 1) return b + c;
	if (!p) p = d * 0.3;

	if (a < Math.abs(c)) {
		a = c;
		s = p / 4;
	} else {
		s = (p / (2 * Math.PI)) * Math.asin(c / a);
	}

	return (
		a * Math.pow(2, -10 * t) * Math.sin(((t * d - s) * (2 * Math.PI)) / p) +
		c +
		b
	);
}

// other useful animation-related functions

export function getRandomAngle(min, max) {
	const randValue = min + Math.random() * (max - min);
	const sign = Math.random() < 0.5 ? 1 : -1;
	return randValue * sign;
}
