import Player from '/views/Player.js';
import Color from '/views/color.js';
import Gradient from '/views/gradient.js';
import { DOM_DEV_NULL } from '/views/constants.js';

const DEFAULT_DOM_REFS = {
	diff: DOM_DEV_NULL,
	t_diff: DOM_DEV_NULL,
	diff_box: null,
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
	plus_minus_lead_indicator: true,
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
		const absolute_diff = Math.abs(diff);
		const absolute_t_diff = Math.abs(t_diff);
		const formatted_diff = this.options.format_score(absolute_diff);
		const lead_indicator =
			!this.options.plus_minus_lead_indicator || diff === 0
				? ''
				: diff > 0
				? '+'
				: '-';
		const color = this.getRankColor(rank_ratio);

		if (Array.isArray(this.dom.diff)) {
			// array hack should not be needed 🤷‍♂️
			this.dom.diff.forEach(node => {
				node.style.color = color;
				node.textContent = formatted_diff;
			});
		} else {
			this.dom.diff.style.color = color;
			if (this.options.plus_minus_lead_indicator && absolute_diff < 1000000) {
				this.dom.diff.textContent = formatted_diff.replace(
					/(^| )(?=\d)/,
					lead_indicator
				);
			} else {
				this.dom.diff.textContent = formatted_diff;
			}
		}

		this.dom.t_diff.style.color = color;
		this.dom.t_diff.textContent = `${lead_indicator}${this.options.format_tetris_diff(
			absolute_t_diff
		)}`;

		// quick hack for garage3_diff layout only
		if (this.dom.diff_box) {
			this.dom.diff_box.classList[
				diff === 0 || rank_ratio >= 1 ? 'remove' : 'add'
			]('leader');
			this.dom.diff_box.classList[
				diff === 0 || rank_ratio <= 0 ? 'remove' : 'add'
			]('laggard');
		}
	}

	setGameRunwayDiff(diff, t_diff, rank_ratio = 0) {
		const absolute_diff = Math.abs(diff);
		const absolute_t_diff = Math.abs(t_diff);
		const color = this.getRankColor(rank_ratio);

		this.dom.runway_diff.style.color = color;
		this.dom.runway_t_diff.style.color = color;

		this.dom.runway_diff.textContent = this.options.format_score(absolute_diff);
		this.dom.runway_t_diff.textContent =
			this.options.format_tetris_diff(absolute_t_diff);
	}

	setProjectionDiff(diff, t_diff, rank_ratio = 0) {
		const absolute_diff = Math.abs(diff);
		const absolute_t_diff = Math.abs(t_diff);
		const color = this.getRankColor(rank_ratio);

		this.dom.projection_diff.style.color = color;
		this.dom.projection_t_diff.style.color = color;

		this.dom.projection_diff.textContent =
			this.options.format_score(absolute_diff);
		this.dom.projection_t_diff.textContent =
			this.options.format_tetris_diff(absolute_t_diff);
	}
}
