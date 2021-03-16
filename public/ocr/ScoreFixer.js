class ScoreFixer {
	constructor() {
		this.last_good_label = null;
	}

	charToDigit(chat) {
		return parseInt(char, 16);
	}

	digitToChar(digit) {
		return digit.toString(16).toUpperCase();
	}

	reset() {
		this.last_good_label = null;
	}

	fix(label, value) {
		if ((label == null) || (this.last_good_label == null)) {
			this.last_good_label = label;
			return [label, value];
		}

		if (this.last_good_label[0] == label[0]) {
			this.last_good_label = label;
			return [label, value];
		}

		const good_first_digit = this.charToDigit(this.last_good_label[0]);
		const new_first_digit = this.charToDigit(label[0]);

		// we should only be able to up by one digit at a time...
		if (new_first_digit == good_first_digit + 1) {
			this.last_good_label = label;
			return [label, value];
		}

		// K, if this point is reached, something is not right, and we need to apply correction

		if (label[0] == 'A') {
			if (this.last_good_label[0] == '3' || this.last_good_label[0] == '4') {
				label = '4' + label.slice(1);
				value += (4-10) * 100000;
			}
		}
		else if (label[0] == '4') {
			if (this.last_good_label[0] == '9' || this.last_good_label[0] == 'A') {
				label = 'A' + label.slice(1);
				value += (10-4) * 100000;
			}
		}
		else if (label[0] == '8') {
			if (this.last_good_label[0] == 'A' || this.last_good_label[0] == 'B') {
				label = 'B' + label.slice(1);
				value += (11-8) * 1000000;
			}
		}
		else if (label[0] == 'B') {
			if (this.last_good_label[0] == '7' || this.last_good_label[0] == '8') {
				label = '8' + label.slice(1);
				value += (8-11) * 1000000;
			}
		}

		this.last_good_label = label

		return [label, value]
	}
}
