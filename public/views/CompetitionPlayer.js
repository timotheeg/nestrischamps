import Player from '/views/Player.js';
import Color from '/views/color.js';
import Gradient from '/views/gradient.js';
import { DOM_DEV_NULL } from '/views/constants.js';

const DEFAULT_DOM_REFS = {
	diff: DOM_DEV_NULL,
	t_diff: DOM_DEV_NULL,
	runway_diff: DOM_DEV_NULL,
	runway_t_diff: DOM_DEV_NULL,
	projection_diff: DOM_DEV_NULL,
	projection_t_diff: DOM_DEV_NULL,
};

const DEFAULT_OPTIONS = {
	diff_color_gradient: new Gradient( // green - orange - red
		'#0eff0e',
		new Color(255, 165, 0),
		'#fd0009'
	),
	format_tetris_diff: v => {
		// ensure result is at most 4 char long
		if (v >= 100) {
			return Math.round(v);
		} else if (v >= 10) {
			return v.toFixed(1);
		} else {
			return v.toFixed(2);
		}
	},
};

export default class CompetitionPlayer extends Player {
	constructor(dom, options) {
		super(
			{
				...DEFAULT_DOM_REFS,
				...dom,
			},
			{
				...DEFAULT_OPTIONS,
				...options,
			}
		);

		this.color_memory = new Map();
	}

	reset() {
		super.reset();

		this.dom.diff.textContent = this.options.format_score(0);
		this.dom.t_diff.textContent = this.options.format_tetris_diff(0);
	}

	getRankColor(rank_ratio) {
		let col = this.color_memory.get(rank_ratio);

		if (!col) {
			col = this.options.diff_color_gradient
				.getColorAt(rank_ratio)
				.toHexString();

			this.color_memory.set(rank_ratio, col);
		}

		return col;
	}

	setDiff(diff, t_diff, rank_ratio = 0) {
		const absDiff = Math.abs(diff);
		const color = this.getRankColor(rank_ratio);

		this.dom.diff.style.color = color;
		this.dom.t_diff.style.color = color;

		this.dom.diff.textContent = this.options.format_score(absDiff);
		this.dom.t_diff.textContent = this.options.format_tetris_diff(t_diff);
	}

	setGameRunwayDiff(diff, t_diff, rank_ratio = 0) {
		const absDiff = Math.abs(diff);
		const color = this.getRankColor(rank_ratio);

		this.dom.runway_diff.style.color = color;
		this.dom.runway_t_diff.style.color = color;

		this.dom.runway_diff.textContent = this.options.format_score(absDiff);
		this.dom.runway_t_diff.textContent =
			this.options.format_tetris_diff(t_diff);
	}

	setProjectionDiff(diff, t_diff, rank_ratio = 0) {
		const absDiff = Math.abs(diff);
		const color = this.getRankColor(rank_ratio);

		this.dom.projection_diff.style.color = color;
		this.dom.projection_t_diff.style.color = color;

		this.dom.projection_diff.textContent = this.options.format_score(absDiff);
		this.dom.projection_t_diff.textContent =
			this.options.format_tetris_diff(t_diff);
	}
}
