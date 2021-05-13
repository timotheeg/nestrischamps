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

		this.dom.diff.textContent = this.options.format_score(0);
		this.dom.t_diff.textContent = this.options.format_tetris_diff(0);
	}

	setDiff(diff, t_diff) {
		if (diff < 0) {
			this.dom.diff.classList.remove('winning');
			this.dom.diff.classList.add('losing');
			this.dom.t_diff.classList.remove('winning');
			this.dom.t_diff.classList.add('losing');
		}
		else {
			this.dom.diff.classList.remove('losing');
			this.dom.diff.classList.add('winning');
			this.dom.t_diff.classList.remove('losing');
			this.dom.t_diff.classList.add('winning');
		}

		// compute a proper visual of the diff
		const absDiff = Math.abs(diff);

		this.dom.diff.textContent = this.options.format_score(absDiff);
		this.dom.t_diff.textContent = this.options.format_tetris_diff(t_diff);
	}

	setGamePaceDiff(diff, t_diff) {
		if (diff < 0) {
			this.dom.p_diff.classList.remove('winning');
			this.dom.p_diff.classList.add('losing');
			this.dom.pt_diff.classList.remove('winning');
			this.dom.pt_diff.classList.add('losing');
		}
		else {
			this.dom.p_diff.classList.remove('losing');
			this.dom.p_diff.classList.add('winning');
			this.dom.pt_diff.classList.remove('losing');
			this.dom.pt_diff.classList.add('winning');
		}

		// compute a proper visual of the diff
		const absDiff = Math.abs(diff);

		this.dom.p_diff.textContent = this.options.format_score(absDiff);
		this.dom.pt_diff.textContent = this.options.format_tetris_diff(t_diff);
	}
}