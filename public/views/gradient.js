import Color from './color.js';

export default class Gradient {
	constructor(/*variable length Color objects*/) {
		const len = arguments.length;

		if (len <= 1) {
			throw new Error('A Gradient needs at least 2 colors');
		}

		// constructor assume equidistant colors
		const divisor = len - 1;
		const m = (this._markers = []);

		for (let idx = 0; idx < len; idx++) {
			m.push({ val: idx / divisor, col: Color.create(arguments[idx]) });
		}

		// to prevent potential float errors, we set last entry explicitely as 1;
		m[divisor].val = 1;
	}

	addColor(val, col) {
		// add a color, garanteeing the markers array is ordered by value
		const m = this._markers;
		val = Math.max(0, Math.min(val, 1));
		col = Color.create(col);

		for (let idx = m.length; idx--; ) {
			// there can be no duplicate values in the markers
			// so if value already exists, we overwrite
			if (val === m[idx].val) {
				m[idx].col = col;
				break;
			} else if (val > m[idx].val) {
				m.splice(idx + 1, 0, { val: val, col: col });
				break;
			}
		}
	}

	getColorAt(ratio) {
		// 1. find slice where ratio falls
		const m = this._markers;
		ratio = Math.max(0, Math.min(ratio, 1));

		for (let idx = m.length; idx--; ) {
			if (ratio === m[idx].val) {
				return m[idx].col;
			}
			if (ratio > m[idx].val) {
				// 2. normalize ratio within slice
				const slice_ratio =
					(ratio - m[idx].val) / (m[idx + 1].val - m[idx].val);
				return m[idx].col.getMidColor(m[idx + 1].col, slice_ratio);
			}
		}

		// should never reach here!
		return new Color(0, 0, 0, 0);
	}
}
