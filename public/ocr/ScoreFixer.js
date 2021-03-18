class ScoreFixer {
	constructor() {
		this.last_good_digits = null;
	}

	charToDigit(chat) {
		return parseInt(char, 16);
	}

	digitToChar(digit) {
		return digit.toString(16).toUpperCase();
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

		const first_digit_diff = digits_copy[0] - this.last_good_digits[0];

		// first digits can be same or increased by 1!
		if (first_digit_diff === 0 || first_digit_diff === 1) {
			this.last_good_digits = digits_copy;
			return digits_copy;
		}

		// K, if this point is reached, something is not right, and we need to apply correction

		if (digits_copy[0] == 0xA) { // A, but should it have been a 4?
			if (this.last_good_digits[0] === 0x3 || this.last_good_digits[0] === 0x4) {
				digits_copy[0] = 0x4;
			}
		}
		else if (digits[0] === 0x4) { // 4, should it have been a A?
			if (this.last_good_digits[0] === 0x9 || this.last_good_digits[0] === 0xA) {
				digits_copy[0] = 0xA;
			}
		}
		else if (digits[0] === 0x8) { // 8, should it have been a B?
			if (this.last_good_digits[0] === 0xA || this.last_good_digits[0] === 0xB) {
				digits_copy[0] = 0xB;
			}
		}
		else if (digits[0] === 0xB) { // B, but should it have been a 8?
			if (this.last_good_digits[0] === 0x7 || this.last_good_digits[0] === 0x8) {
				digits_copy[0] = 0x8;
			}
		}

		this.last_good_digits = digits_copy;

		return digits_copy;
	}
}
