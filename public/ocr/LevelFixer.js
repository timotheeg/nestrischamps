class LevelFixer {
	constructor() {
		this.last_good_digits = null;
	}

	reset() {
		this.last_good_digits = null;
	}

	fix(digits) {
		const digits_copy = digits.concat();

		if (this.last_good_digits == null) {
			this.last_good_digits = digits_copy;
			return digits_copy;
		}

		// level maps for 30 to 35
		// 00:30 - 0A:31 - 14:32 - 1E:33 - 28:34 - 32:35
		// what's the logic? 🤔

		// Fix the levels with no ambiguity
		if (digits_copy[0] === 0x1 && digits_copy[1] === 0xE) { // 1E -> 33
			digits_copy[0] = 0x3;
			digits_copy[1] = 0x3;
		}
		else if (digits_copy[0] === 0x3 && digits_copy[1] === 0x2) { // 32 -> 35
			digits_copy[1] = 0x5;
		}

		// fix the funny ones
		else {
			if (digits_copy[0] === 0x0 && digits_copy[1] === 0x0) {
				if (
					(this.last_good_digits[0] === 0x2 && this.last_good_digits[1] === 0x9)
					||
					(this.last_good_digits[0] === 0x3 && this.last_good_digits[1] === 0x0)
				) {
					digits_copy[0] = 0x3;
				}
			}
			else if (digits_copy[0] === 0x0 && (digits_copy[1] === 0x4 || digits_copy[1] === 0xA))  {
				if (this.last_good_digits[0] === 0x3 && (
					this.last_good_digits[1] === 0x0
					||
					this.last_good_digits[1] === 0x1
				)) {
					digits_copy[0] = 0x3;
					digits_copy[1] = 0x1;
				}
			}
			else if (digits_copy[0] === 0x1 && (digits_copy[1] === 0x4 || digits_copy[1] === 0xA))  {
				if (this.last_good_digits[0] === 0x3 && (
					this.last_good_digits[1] === 0x1
					||
					this.last_good_digits[1] === 0x2
				)) {
					digits_copy[0] = 0x3;
					digits_copy[1] = 0x2;
				}
			}
			else if (digits_copy[0] === 0x2 && (digits_copy[2] === 0x8 || digits_copy[2] === 0xB))  {
				if (this.last_good_digits[0] === 0x3 && (
					this.last_good_digits[1] === 0x3
					||
					this.last_good_digits[1] === 0x4
				)) {
					digits_copy[0] = 0x3;
					digits_copy[1] = 0x4;
				}
			}

			// Fix all other A and B in second place, since they're impossible
			if (digits_copy[1] === 0xA) {
				digits_copy[1] = 0x4;
			}
			else if (digits_copy[1] === 0xB) {
				digits_copy[1] = 0x8;
			}
		}

		this.last_good_digits = digits_copy;

		return digits_copy;
	}
}