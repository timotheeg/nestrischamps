class LevelFixer {
	constructor() {
		this.last_good_digits = null;
	}

	reset() {
		this.last_good_digits = null;
	}

	fix(_digits) {
		if (_digits === null) {
			// don't store nulls (assume pause)
			// last_good_digits will still be used on resume
			// reset() must be called to clean last_good_digits
			return null;
		}

		const digits = _digits.concat(); // make a local copy of the array

		if (this.last_good_digits == null) {
			this.last_good_digits = digits;
			return digits;
		}

		// level maps for 30 to 35
		// 00:30 - 0A:31 - 14:32 - 1E:33 - 28:34 - 32:35
		// what's the logic? 🤔

		// Fix the levels with no ambiguity
		if (digits[0] === 0x1 && digits[1] === 0xE) { // 1E -> 33
			digits[0] = 0x3;
			digits[1] = 0x3;
		}
		else if (digits[0] === 0x3 && digits[1] === 0x2) { // 32 -> 35
			digits[0] = 0x3;
			digits[1] = 0x5;
		}

		// fix the funny ones
		else {
			// 00 - could be 00 or 30
			if (digits[0] === 0x0 && digits[1] === 0x0) {
				if (
					(this.last_good_digits[0] === 0x2 && this.last_good_digits[1] === 0x9)
					||
					(this.last_good_digits[0] === 0x3 && this.last_good_digits[1] === 0x0)
				) {
					digits[0] = 0x3;
				}
			}

			// 04 or 0A - could be 04 or 31
			else if (digits[0] === 0x0 && (digits[1] === 0x4 || digits[1] === 0xA))  {
				if (this.last_good_digits[0] === 0x3 && (
					this.last_good_digits[1] === 0x0
					||
					this.last_good_digits[1] === 0x1
				)) {
					digits[0] = 0x3;
					digits[1] = 0x1;
				}
			}

			// 14 or 1A - could be 14 or 32
			else if (digits[0] === 0x1 && (digits[1] === 0x4 || digits[1] === 0xA))  {
				if (this.last_good_digits[0] === 0x3 && (
					this.last_good_digits[1] === 0x1
					||
					this.last_good_digits[1] === 0x2
				)) {
					digits[0] = 0x3;
					digits[1] = 0x2;
				}
			}

			// 28 or 2B - could be 28 or 34
			else if (digits[0] === 0x2 && (digits[1] === 0x8 || digits[1] === 0xB))  {
				if (this.last_good_digits[0] === 0x3 && (
					this.last_good_digits[1] === 0x3
					||
					this.last_good_digits[1] === 0x4
				)) {
					digits[0] = 0x3;
					digits[1] = 0x4;
				}
			}

			// Fix all other A and B in second place, since they're impossible (at least till level 35 anyway...)
			if (digits[1] === 0xA) {
				digits[1] = 0x4;
			}
			else if (digits[1] === 0xB) {
				digits[1] = 0x8;
			}
		}

		this.last_good_digits = digits;

		return digits;
	}
}
