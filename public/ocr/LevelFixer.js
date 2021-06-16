/*

Levels beyond 30

30 -> 00
31 -> 0A
32 -> 14
33 -> 1E ✅
34 -> 28
35 -> 32 ✅
36 -> 3C ✅
37 -> 46
38 -> 50 ✅
39 -> 5A
40 -> 64
41 -> 6E ✅
42 -> 78
43 -> 82
44 -> 8C
45 -> 96 ✅
46 -> A0
47 -> AA
48 -> B4
49 -> BE

Basically with formula:
30 + (hex(value) / 0x0A)

Reference:
https://meatfighter.com/nintendotetrisai/#Level_30_and_Beyond

We correct all possible misreads of A/4 and B/8

/**/

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

		switch (digits[0]) {
			case 0x0:
				if (digits[1] === 0x0) {
					// 00 - could be 00 or 30
					if (
						this.last_good_digits[0] === 0x2 ||
						this.last_good_digits[0] === 0x3
					) {
						digits[0] = 0x3;
					}
				} else if (digits[1] === 0x4 || digits[1] === 0xa) {
					// 04 or 0A - could be 04 or 31
					if (this.last_good_digits[0] === 0x3) {
						digits[0] = 0x3;
						digits[1] = 0x1;
					} else {
						digits[1] = 0x4;
					}
				}

				break;

			case 0x1:
				if (digits[1] === 0x4 || digits[1] === 0xa) {
					// 14 or 1A - could be 14 or 32
					if (this.last_good_digits[0] === 0x3) {
						digits[0] = 0x3;
						digits[1] = 0x2;
					} else {
						digits[1] = 0x4;
					}
				}
				break;
			case 0x2:
				if (digits[1] === 0x8 || digits[1] === 0xb) {
					// 28 or 2B - could be 28 or 34
					if (this.last_good_digits[0] === 0x3) {
						digits[0] = 0x3;
						digits[1] = 0x4;
					} else {
						digits[1] = 0x8;
					}
				}
				break;

			case 0x3:
				if (digits[1] === 0x2) {
					// 32 -> 35
					digits[1] = 0x5;
				} else if (digits[1] === 0xc) {
					// 3C -> 36
					digits[1] = 0x6;
				}
				break;

			case 0x4:
			case 0xa:
				if (digits[1] === 0x6) {
					// 46 -> 37
					digits[0] = 0x3;
					digits[1] = 0x7;
				} else if (digits[1] === 0x0) {
					// A0 -> 46
					digits[0] = 0x4;
					digits[1] = 0x6;
				} else {
					// AA -> 47
					digits[0] = 0x4;
					digits[1] = 0x7;
				}
				break;

			case 0x5:
				digits[0] = 0x3;
				if (digits[1] === 0x0) {
					// 50 -> 38
					digits[1] = 0x8;
				} else {
					// 5A -> 39
					digits[1] = 0x9;
				}

			case 0x6:
				digits[0] = 0x4;
				if (digits[1] === 0xe) {
					// 6e -> 41
					digits[1] = 0x1;
				} else {
					// 64 -> 40
					digits[1] = 0x0;
				}
				break;

			case 0x7:
				// 78 -> 42
				digits[0] = 0x4;
				digits[1] = 0x2;
				break;

			case 0x8:
			case 0xb:
				digits[0] = 0x4;

				if ((digits[1] = 0x2)) {
					// 82 -> 43
					digits[1] = 0x3;
				} else if ((digits[1] = 0xc)) {
					// 8c -> 44
					digits[1] = 0x4;
				} else if ((digits[1] = 0xe)) {
					// be -> 48
					digits[1] = 0x8;
				} else {
					// b4 -> 49
					digits[1] = 0x9;
				}
				break;

			case 0x9:
				// 96 -> 45
				digits[0] = 0x4;
				digits[1] = 0x5;
				break;
		}

		// Finally, fix all other A and B in second place, since they're impossible (at least till level 49 anyway...)
		if (digits[1] === 0xa) {
			digits[1] = 0x4;
		} else if (digits[1] === 0xb) {
			digits[1] = 0x8;
		}

		this.last_good_digits = digits;

		return digits;
	}
}
