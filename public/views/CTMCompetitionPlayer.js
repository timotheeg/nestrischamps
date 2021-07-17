const CTMCompetitionPlayer = (function () {
	const DEFAULT_DOM_REFS = {
		drought_box: DOM_DEV_NULL,
		runway_box: DOM_DEV_NULL,
		projection_box: DOM_DEV_NULL,
	};

	// one time check of Query String args
	let buffer_time = QueryString.get('buffer_time') || '';

	if (/^\d+$/.test(buffer_time)) {
		buffer_time = parseInt(buffer_time, 10);
	} else {
		buffer_time = 0;
	}

	const DEFAULT_OPTIONS = {
		buffer_time,
	};

	class CTMCompetitionPlayer extends CompetitionPlayer {
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

			// hack to force elements to be invisible no matter what
			this.dom.runway_box.onanimationend =
				this.dom.projection_box.onanimationend = () => {
					this.dom.runway_box.style.display = 'none';
					this.dom.projection_box.style.display = 'none';
				};

			// sets up custom UI behaviours
			this.onDroughtStart = () => {
				this.dom.drought_box.classList.add('active');
			};

			this.onDroughtEnd = () => {
				this.dom.drought_box.classList.remove('active');
			};

			this.onKillScreen = () => {
				this.dom.runway_box.classList.add('past_killscreen');
				this.dom.projection_box.classList.add('past_killscreen');
			};

			this.onGameStart = () => {
				this.dom.drought_box.classList.remove('active');

				this.dom.runway_box.classList.remove('past_killscreen');
				this.dom.projection_box.classList.remove('past_killscreen');

				this.dom.runway_box.style.display = null;
				this.dom.projection_box.style.display = null;

				this.dom.level.hidden = false;
				this.dom.preview.hidden = false;
			};

			this.onGameOver = () => {
				this.dom.level.hidden = true;
				this.dom.preview.hidden = true;
			};
		}
	}

	return CTMCompetitionPlayer;
})();
