/*jshint boss:true, smarttabs:true, laxcomma:true, laxbreak:true, bitwise:false */

var module_setup = function (undefined) {
	'use strict';

	// ===================================================
	// Private Statics
	// ===================================================

	var _min = Math.min,
		_max = Math.max,
		isNumber = function (v) {
			return typeof v === 'number';
		},
		isInt = function (v) {
			return isNumber(v) && v % 1 === 0;
		},
		isInRange = function (v, min, max) {
			return v >= min && v <= max;
		},
		clamp = function (v, min, max) {
			return _max(min, _min(v, max));
		};

	// ===================================================
	// Constructor
	// ===================================================

	var Color = function (r, g, b, a) {
		// a is optional, if it not defined, we set up default NOW
		if (a === undefined) a = 1;

		// all color components MUST be valid to be accepted
		if (
			!(
				isInt(r) &&
				isInRange(r, 0, 255) &&
				isInt(g) &&
				isInRange(g, 0, 255) &&
				isInt(b) &&
				isInRange(b, 0, 255) &&
				isNumber(a) &&
				isInRange(a, 0, 1)
			)
		) {
			throw new Error('invalid arguments: ' + [r, g, b, a]);
		}

		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	};

	// ===================================================
	// Static Color methods below
	// ===================================================

	Color.create = function (entry) {
		if (entry instanceof Color) {
			return entry.clone();
		}

		switch (typeof entry) {
			case 'number':
				return this.createFromInt(entry);

			case 'string':
				return this.createFromHexString(entry);

			case 'object':
				return this.createFromObject(entry);
		}

		throw new Error('Not a color: ' + entry);
	};

	// hex string regexps will be lazy-initialized
	var res = null;
	var localCreateFromHexString = function (str) {
		if (!res) {
			res = [
				[
					new RegExp('^#([0-9a-f])$'),
					function (m) {
						var v = parseInt(m[1] + m[1], 16);
						return new Color(v, v, v);
					},
				],

				[
					new RegExp('^#([0-9a-f]{2})$'),
					function (m) {
						var v = parseInt(m[1], 16);
						return new Color(v, v, v);
					},
				],

				[
					new RegExp('^#([0-9a-f]{3})$'),
					function (m) {
						var s = m[1];
						return new Color(
							parseInt(s.charAt(0) + s.charAt(0), 16),
							parseInt(s.charAt(1) + s.charAt(1), 16),
							parseInt(s.charAt(2) + s.charAt(2), 16)
						);
					},
				],

				[
					new RegExp('^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$'),
					function (m) {
						return new Color(
							parseInt(m[1], 16),
							parseInt(m[2], 16),
							parseInt(m[3], 16)
						);
					},
				],
			];
		}

		var m;
		for (var idx = res.length; idx-- > 0; ) {
			if ((m = res[idx][0].exec(str))) {
				return res[idx][1](m);
			}
		}

		throw new Error('Not a valid hex color: ' + s);
	};

	var named_cache = {},
		named = {
			aqua: '#0ff',
			black: '#0',
			blue: '#00f',
			fuchsia: '#f0f',
			grey: '#80',
			gray: '#80',
			green: '#008000',
			lime: '#0f0',
			maroon: '#800000',
			navy: '#000080',
			olive: '#808000',
			purple: '#800080',
			red: '#f00',
			silver: '#c0',
			teal: '#008080',
			white: '#f',
			yellow: '#ff0',
		};

	Color.createFromHexString = function (entry) {
		entry = entry.toLowerCase();

		// check local cache to reduce repeat parsing
		if (named_cache[entry]) {
			return named_cache[entry];
		}
		if (named[entry]) {
			return (named_cache[entry] = localCreateFromHexString(named[entry]));
		}

		return localCreateFromHexString(entry);
	};

	Color.createFromInt = function (entry) {
		entry = Math.round(entry);
		return new Color(
			(entry & 0xff0000) >> 16,
			(entry & 0xff00) >> 8,
			entry & 0xff
		);
	};

	Color.createFromObject = function (entry) {
		var r, g, b, a;

		if (isInt(entry.r) && isInt(entry.g) && isInt(entry.b)) {
			// basic check for ints at named fields passed
			r = entry.r;
			g = entry.g;
			b = entry.b;
			a = entry.a;
		} else if (isInt(entry[0]) && isInt(entry[1]) && isInt(entry[2])) {
			// basic check for ints at fixed indexes passed (~Array)
			r = entry[0];
			g = entry[1];
			b = entry[2];
			a = entry[3];
		} else {
			throw new Error('Not a color: ' + entry);
		}

		// if we reach here, we will be forgiving and force the parameters into correct values/ranges
		// special logic required for the opacity parameter a, which is optional
		switch (typeof a) {
			case 'number':
				a = clamp(a, 0, 1);
				break;

			case 'string':
				a = parseFloat(a);
				a = isNaN(a) ? undefined : clamp(a, 0, 1);
				break;

			case 'boolean':
				a = a ? 1 : 0;
				break;

			default:
				// if we reach here, something is wrong with a
				// we could throw (?), but let's pretend a was not present, and generate a valid color
				a = undefined;
		}

		return new Color(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), a);
	};

	Color.getMidChannel = function (start, end, ratio) {
		// Channel blending needs to be done in square space
		// See: https://www.youtube.com/watch?v=LKnqECcg6Gw
		var value = start * start + (end * end - start * start) * ratio;

		return Math.round(Math.sqrt(value));
	};

	// ===================================================
	// Instance methods below
	// ===================================================

	var p = Color.prototype;

	p.toRGBAString = function () {
		var channels = [this.r, this.g, this.b];
		return (
			(this.a >= 1 ? 'rgb(' : (channels.push(this.a), 'rgba(')) +
			channels.join(',') +
			')'
		);
	};

	p.toHexString = function () {
		var r = this.r.toString(16);
		var g = this.g.toString(16);
		var b = this.b.toString(16);
		return (
			'#' +
			(r.length < 2 ? '0' : '') +
			r +
			(g.length < 2 ? '0' : '') +
			g +
			(b.length < 2 ? '0' : '') +
			b
		);
	};

	p.toString = p.toHexString;

	p.toInt = function () {
		return (this.r << 16) | (this.g << 8) | this.b;
	};

	p.toArray = function () {
		return [this.r, this.g, this.b, this.a];
	};

	p.clone = function () {
		return new Color(this.r, this.g, this.b, this.a);
	};

	p.getMidColor = function (targetCol, ratio) {
		ratio = !isNumber(ratio) ? 0.5 : clamp(ratio, 0, 1);

		return new Color(
			Color.getMidChannel(this.r, targetCol.r, ratio),
			Color.getMidChannel(this.g, targetCol.g, ratio),
			Color.getMidChannel(this.b, targetCol.b, ratio),
			this.a + (targetCol.a - this.a) * ratio // does this need to be done in square space too?
		);
	};

	return Color;
};

// ===================================================
// Access control
// ===================================================

if (typeof define !== 'undefined') {
	// AMD compatibility
	define([], module_setup);
} else if (typeof module !== 'undefined' && module.exports) {
	// exports
	module.exports = module_setup();
} else {
	// brings class to current context
	this.Color = module_setup();
}
