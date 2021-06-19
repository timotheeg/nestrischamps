const CompetitionPlayer = (function () {
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

	class CompetitionPlayer extends Player {
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
		}

		reset() {
			super.reset();

			this.dom.diff.textContent = this.options.format_score(0);
			this.dom.t_diff.textContent = this.options.format_tetris_diff(0);
		}

		setDiff(diff, t_diff, winner_order_ratio = 0) {
			const absDiff = Math.abs(diff);
			const color = this.options.diff_color_gradient
				.getColorAt(winner_order_ratio)
				.toHexString();

			this.dom.diff.style.color = color;
			this.dom.t_diff.style.color = color;

			this.dom.diff.textContent = this.options.format_score(absDiff);
			this.dom.t_diff.textContent = this.options.format_tetris_diff(t_diff);
		}

		setGameRunwayDiff(diff, t_diff, winner_order_ratio = 0) {
			const absDiff = Math.abs(diff);
			const color = this.options.diff_color_gradient
				.getColorAt(winner_order_ratio)
				.toHexString();

			this.dom.runway_diff.style.color = color;
			this.dom.runway_t_diff.style.color = color;

			this.dom.runway_diff.textContent = this.options.format_score(absDiff);
			this.dom.runway_t_diff.textContent =
				this.options.format_tetris_diff(t_diff);
		}

		setProjectionDiff(diff, t_diff, winner_order_ratio = 0) {
			const absDiff = Math.abs(diff);
			const color = this.options.diff_color_gradient
				.getColorAt(winner_order_ratio)
				.toHexString();

			this.dom.projection_diff.style.color = color;
			this.dom.projection_t_diff.style.color = color;

			this.dom.projection_diff.textContent = this.options.format_score(absDiff);
			this.dom.projection_t_diff.textContent =
				this.options.format_tetris_diff(t_diff);
		}
	}

	return CompetitionPlayer;
})();
