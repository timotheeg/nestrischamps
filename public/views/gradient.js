var module_setup = function (Color, undefined) {
	'use strict';

	var Gradient = function (/*variable length Color objects*/) {
		var len = arguments.length;
		if (len <= 1) {
			throw new Error('A Gradient needs at least 2 colors');
		}

		// constructor assume equidistant colors
		var divisor = len - 1;
		var m = (this._markers = []);
		for (var idx = 0; idx < len; idx++) {
			m.push({ val: idx / divisor, col: Color.create(arguments[idx]) });
		}

		// to prevent potential float errors, we set last entry explicitely as 1;
		m[divisor].val = 1;
	};

	var p = Gradient.prototype;
	p.addColor = function (val, col) {
		// add a color, garanteeing the markers array is ordered by value
		var m = this._markers;
		val = Math.max(0, Math.min(val, 1));
		col = Color.create(col);

		for (var idx = m.length; idx--; ) {
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
	};

	p.getColorAt = function (ratio) {
		// 1. find slice where ratio falls
		var m = this._markers;
		ratio = Math.max(0, Math.min(ratio, 1));

		for (var idx = m.length; idx--; ) {
			if (ratio === m[idx].val) {
				return m[idx].col;
			}
			if (ratio > m[idx].val) {
				// 2. normalize ratio within slice
				var slice_ratio = (ratio - m[idx].val) / (m[idx + 1].val - m[idx].val);
				return m[idx].col.getMidColor(m[idx + 1].col, slice_ratio);
			}
		}

		// should never reach here!
		return new Color(0, 0, 0, 0);
	};

	return Gradient;
};

// ===================================================
// Visibility control
// ===================================================

if (typeof define !== 'undefined') {
	// AMD compatibility
	define(['color'], module_setup);
} else if (typeof module !== 'undefined' && module.exports) {
	// sets up a hard dependency on color.js; providing Color class
	module.exports = module_setup(require('./color.js'));
} else {
	// Assumes Color is available within same context
	this.Gradient = module_setup(this.Color);
}
