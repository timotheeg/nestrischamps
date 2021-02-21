/*
	dom: {
		... parents
		diff
	}
*/


class CompetitionPlayer extends Player {
	constructor(dom, options) {
		super(dom, options);
	}

	reset() {
		super.reset();

		this.dom.diff.textContent = '';
	}

	setDiff(diff) {
		if (diff < 0) {
			this.dom.diff.classList.remove('winning');
			this.dom.diff.classList.add('losing');
		}
		else {
			this.dom.diff.classList.remove('losing');
			this.dom.diff.classList.add('winning');
		}

		// compute a proper vvisual of the diff
		const absDiff = Math.abs(diff);

		this.dom.diff.textContent = this.numberFormatter.format(absDiff);
	}
}