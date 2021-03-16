class LevelFixer {
	constructor() {
		this.last_good_label = null;
	}

	reset() {
		this.last_good_label = null;
	}

	fix(label, value) {
		if (label == null || this.last_good_label == null) {
			this.last_good_label = label;
			return [label, value];
		}

		// level maps for 30 to 35
		// 00:30 - 0A:31 - 14:32 - 1E:33 - 28:34 - 32:35
		// what's the logic? 🤔

		// Fix the levels with no ambiguity
		if (label == '1E') {
			label = '33';
			value = 33;
		}
		else if (label == '32') {
			label = '35';
			value = 35;
		}

		// fix the funny ones
		else {
			if (label == '00') {
				if (this.last_good_label == '29' || this.last_good_label == '30') {
					label = '30';
					value = 30;
				}
			}
			else if (label == '0A' || label == '04') {
				if (this.last_good_label == '30' || this.last_good_label == '31') {
					label = '31';
					value = 31;
				}
			}
			else if (label == '14' || label == '1A') {
				if (this.last_good_label == '31' || this.last_good_label == '32') {
					label = '32';
					value = 32;
				}
			}
			else if (label == '28' || label == '2B') {
				if (this.last_good_label == '33' || this.last_good_label == '34' ) {
					label = '34';
					value = 34;
				}
			}

			// Fix all other A and B in second place, since they're impossible
			if (label[1] == 'A') {
				label = label[0] + '4';
				value += (4-10);
			}
			else if (label[1] == 'B') {
				label = label[0] + '8';
				value += (8-11);
			}
		}

		this.last_good_label = label;

		return [label, value];
	}
}