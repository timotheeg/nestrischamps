import QueryString from '/js/QueryString.js';
import renderBlock from '/views/renderBlock.js';
import FrameBuffer from '/views/FrameBuffer.js';
import BaseGame from '/views/BaseGame.js';
import { css_size, clamp, getPercent, peek } from '/views/utils.js';

import { PIECE_COLORS, DOM_DEV_NULL, LINES } from '/views/constants.js';

const WINNER_FACE_BLOCKS = [
	[12, 3],
	[12, 6],
	[15, 2],
	[15, 7],
	[16, 3],
	[16, 4],
	[16, 5],
	[16, 6],
];

const LOSER_FACE_BLOCKS = [
	[12, 3],
	[12, 6],
	[15, 3],
	[15, 4],
	[15, 5],
	[15, 6],
	[16, 2],
	[16, 7],
];

const BORDER_BLOCKS = [
	[0, 0],
	[1, 0],
	[2, 0],
	[3, 0],
	[4, 0],
	[5, 0],
	[6, 0],
	[7, 0],
	[8, 0],
	[9, 0],
	[10, 0],
	[11, 0],
	[12, 0],
	[13, 0],
	[14, 0],
	[15, 0],
	[16, 0],
	[17, 0],
	[18, 0],
	[19, 0],

	[19, 1],
	[19, 2],
	[19, 3],
	[19, 4],
	[19, 5],
	[19, 6],
	[19, 7],
	[19, 8],
	[19, 9],

	[18, 9],
	[17, 9],
	[16, 9],
	[15, 9],
	[14, 9],
	[13, 9],
	[12, 9],
	[11, 9],
	[10, 9],
	[9, 9],
	[8, 9],
	[7, 9],
	[6, 9],
	[5, 9],
	[4, 9],
	[3, 9],
	[2, 9],
	[1, 9],
	[0, 9],

	[0, 8],
	[0, 7],
	[0, 6],
	[0, 5],
	[0, 4],
	[0, 3],
	[0, 2],
	[0, 1],
];

const PASSTHROUGH_HANDLERS = [
	'onGameStart',
	'onDroughtStart',
	'onDroughtEnd',
	'onKillScreen',
	'onCurtainDown',
];

const fake_data = { count: 0, lines: 0, percent: 0, drought: 0, indexes: [] };
const fake_clear_evt = {
	tetris_rate: 0,
	efficiency: 0,
	burn: 0,
	lines: 0,
	clears: {
		1: fake_data,
		2: fake_data,
		3: fake_data,
		4: fake_data,
	},
};
const fake_piece_evt = {
	deviation: 0,
	deviation_28: 0,
	deviation_56: 0,
	pieces: {},
	i_droughts: {
		count: 0,
		cur: 0,
		max: 0,
		last: 0,
	},
	das: {
		avg: 0,
		ok: 0,
		great: 0,
		bad: 0,
	},
};

/*
dom: {
	score:   text element
	level:   text element
	lines:   text element
	trt:     text element
	preview: div for canva
	field:   div for canva
}

options: {
	preview_pixel_size: int,
	field_pixel_size: int,
	running_trt_rtl: bool,
	wins_rtl: bool,
}
*/

function easeOutQuart(t, b, c, d) {
	return -c * ((t = t / d - 1) * t * t * t - 1) + b;
}

// One time check of Query String args
// Bit dirty to have Player.js access query String
// But that's the most covenient way to share the functionality
let buffer_time = QueryString.get('buffer_time') || '';

if (/^\d+$/.test(buffer_time)) {
	buffer_time = parseInt(buffer_time, 10);
} else {
	buffer_time = 0;
}

const DEFAULT_DOM_REFS = {
	name: DOM_DEV_NULL,
	score: DOM_DEV_NULL,
	runway_tr: DOM_DEV_NULL,
	runway_game: DOM_DEV_NULL,
	runway_lv19: DOM_DEV_NULL,
	runway_lv29: DOM_DEV_NULL,
	runway_lv39: DOM_DEV_NULL,
	projection: DOM_DEV_NULL,
	level: DOM_DEV_NULL,
	lines: DOM_DEV_NULL,
	trt: DOM_DEV_NULL,
	eff: DOM_DEV_NULL,
	// running_trt: DOM_DEV_NULL, // don't default to a node, so we can identify it is not present, and save on processing
	preview: document.createElement('div'),
	field: document.createElement('div'),
	drought: DOM_DEV_NULL,
	burn: DOM_DEV_NULL,
	video: DOM_DEV_NULL,
	curtain: null,
	flag: null,
};

const DEFAULT_OPTIONS = {
	field_pixel_size: 3,
	preview_pixel_size: 3,
	running_trt_dot_size: 4,
	preview_align: 'c',
	running_trt_rtl: 0,
	wins_rtl: 0,
	tetris_flash: QueryString.get('tetris_flash') !== '0',
	tetris_sound: QueryString.get('tetris_sound') !== '0',
	stereo: 0, // [-1, 1] representing left:-1 to right:1
	reliable_field: 1,
	draw_field: 1,
	curtain: 1,
	buffer_time,
	format_score: (v, size) => {
		if (!size) {
			size = 7;
		}

		if (size == 6 && v >= 1000000) {
			const tail = `${v % 100000}`.padStart(5, '0');
			const head = Math.floor(v / 100000);
			v = `${head.toString(16).toUpperCase()}${tail}`;
		} else {
			v = `${v}`;
		}

		return v.padStart(size, ' ');
	},
	format_drought: v => v,
};

export default class Player {
	constructor(dom, options) {
		this.dom = {
			...DEFAULT_DOM_REFS,
			...dom,
		};
		this.options = {
			...DEFAULT_OPTIONS,
			...options,
		};

		this.ready = false;

		this.field_pixel_size =
			this.options.field_pixel_size || this.options.pixel_size;
		this.preview_pixel_size =
			this.options.preview_pixel_size || this.options.pixel_size;
		this.render_running_trt_rtl = !!this.options.running_trt_rtl;
		this.render_wins_rtl = !!this.options.wins_rtl;

		const styles = getComputedStyle(this.dom.field);

		// getComputedStyle returns padding in Chrome,
		// but Firefox returns 4 individual properties paddingTop, paddingLeft, etc...

		const field_padding_lr = css_size(styles.paddingLeft);
		const field_padding_tb = css_size(styles.paddingTop);

		let bg_width,
			bg_height,
			bg_offset,
			field_canva_offset_t,
			field_canva_offset_l;

		if (field_padding_lr || field_padding_tb) {
			bg_width = css_size(styles.width) + 2 * field_padding_lr;
			bg_height = css_size(styles.height) + 2 * field_padding_tb;
			bg_offset = 0;
			field_canva_offset_t = field_padding_tb;
			field_canva_offset_l = field_padding_lr;
		} else {
			// when padding is zero, we assume the padding is embedded in the border itself and equal on all sides
			// and the padding has the size of this.field_pixel_size
			bg_width = css_size(styles.width) + this.field_pixel_size * 2;
			bg_height = css_size(styles.height) + this.field_pixel_size * 2;
			bg_offset = this.field_pixel_size * -1;
			field_canva_offset_t = this.field_pixel_size;
			field_canva_offset_l = this.field_pixel_size;
		}

		this.bg_height = bg_height; // store value for curtain animation

		// Field Flash
		this.field_bg = document.createElement('div');
		this.field_bg.classList.add('background');
		Object.assign(this.field_bg.style, {
			position: 'absolute',
			top: `${bg_offset}px`,
			left: `${bg_offset}px`,
			width: `${bg_width}px`,
			height: `${bg_height}px`,
		});
		this.dom.field.prepend(this.field_bg);

		// Avatar Block
		this.avatar = document.createElement('div');
		this.avatar.classList.add('avatar');
		Object.assign(this.avatar.style, {
			position: 'absolute',
			top: `${field_padding_tb + this.field_pixel_size * 8}px`,
			left: `${bg_offset}px`,
			width: `${bg_width}px`,
			height: `${bg_width}px`,
			backgroundRepeat: 'no-repeat',
			backgroundSize: 'cover',
			backgroundPosition: '50% 50%',
			filter: 'brightness(0.20)',
		});
		this.dom.field.prepend(this.avatar);

		// set up field and preview canvas
		['field', 'preview', 'running_trt'].forEach(name => {
			if (!this.dom[name]) return;

			const styles = getComputedStyle(this.dom[name]);
			const canvas = document.createElement('canvas');

			canvas.style.position = 'absolute';
			canvas.style.top = styles.paddingTop;
			canvas.style.left = styles.paddingLeft;

			canvas.setAttribute('width', css_size(styles.width));
			canvas.setAttribute('height', css_size(styles.height));

			this.dom[name].appendChild(canvas);

			this[`${name}_ctx`] = canvas.getContext('2d');
		});

		this.has_curtain = this.options.curtain || this.dom.curtain;

		if (this.has_curtain) {
			// start - Field curtain
			this.curtain_viewport = document.createElement('div');
			this.curtain_viewport.classList.add('curtain_viewport');
			Object.assign(this.curtain_viewport.style, {
				position: 'absolute',
				top: `${bg_offset}px`,
				left: `${bg_offset}px`,
				width: `${bg_width}px`,
				height: `${bg_height}px`,
				overflow: 'hidden',
			});
			this.dom.field.appendChild(this.curtain_viewport);

			this.curtain_container = document.createElement('div');
			this.curtain_container.classList.add('curtain_container');
			Object.assign(this.curtain_container.style, {
				position: 'absolute',
				top: `-${bg_height}px`,
				left: 0,
				width: `${bg_width}px`,
				height: `${bg_height}px`,
				background: 'rgba(0, 0, 0, 0.9)',
				overflow: 'hidden',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
			});
			this.curtain_viewport.appendChild(this.curtain_container);

			this.setCurtainLogo();
			this._hideCurtain();
		}

		this.profile_card = document.createElement('iframe');
		Object.assign(this.profile_card.style, {
			position: 'absolute',
			top: `${bg_offset}px`,
			left: `${bg_offset}px`,
			width: `${bg_width}px`,
			height: `${bg_height}px`,
			border: 0,
			margin: 0,
			padding: 0,
			overflow: 'hidden',
		});
		this.profile_card.hidden = true;
		this.dom.field.appendChild(this.profile_card);

		this.field_ctx.canvas.style.top = `${field_canva_offset_t}px`;
		this.field_ctx.canvas.style.left = `${field_canva_offset_l}px`;
		this.field_bg.appendChild(this.field_ctx.canvas);

		if (this.render_running_trt_rtl && this.running_trt_ctx) {
			this.running_trt_ctx.canvas.style.transform = 'scale(-1, 1)';
		}

		// buils audio objects
		this.audioContext = new AudioContext();
		this.sounds = {
			tetris: new Audio('/views/Tetris_Clear.mp3'),
		};

		this.options.stereo = clamp(this.options.stereo, -1, 1);

		Object.entries(this.sounds).forEach(([sound, audio]) => {
			const track = this.audioContext.createMediaElementSource(audio);
			const stereoNode = new StereoPannerNode(this.audioContext, {
				pan: this.options.stereo,
			});

			track.connect(stereoNode).connect(this.audioContext.destination);

			this.sounds[sound] = () => {
				if (this.audioContext.state === 'suspended') {
					this.audioContext.resume();
				}

				audio.play();
			};
		});

		this.renderWinnerFrame = this.renderWinnerFrame.bind(this);
		this._setFrameOuter = this._setFrameOuter.bind(this);

		this._renderValidFrame = this._renderValidFrame.bind(this);
		this._renderScore = this._renderScore.bind(this);
		this._renderLevel = this._renderLevel.bind(this);
		this._renderLines = this._renderLines.bind(this);
		this._renderTransition = this._renderTransition.bind(this);
		this._renderPiece = this._renderPiece.bind(this);
		this._renderNewGame = this._renderNewGame.bind(this);
		this._renderGameOver = this._renderGameOver.bind(this);
		this._doTetris = this._doTetris.bind(this);

		this._playerReset();
	}

	onScore() {}
	onPiece() {}
	onLines() {}
	onLevel() {}
	onTransition() {}
	onKillScreen() {}
	onDroughtStart() {}
	onDroughtEnd() {}
	onGameStart() {}
	onGameOver() {}
	onCurtainDown() {}
	onTetris() {}

	setReady(isReady) {
		this.ready = !!isReady;
	}

	showProfileCard(visible) {
		this.profile_card.hidden = !visible;
		// if (visible) this._refreshProfileCard(); // will this cause a flicker? -> yes :(
	}

	setCurtainLogo(url) {
		if (!this.has_curtain) return;

		// empty curtain container now
		[...this.curtain_container.children].forEach(child => child.remove());

		if (this.dom.curtain) {
			this.curtain_container.appendChild(this.dom.curtain);
			return;
		}

		if (url) {
			const custom_logo = document.createElement('img');
			custom_logo.classList.add('logo');
			custom_logo.src = url;
			Object.assign(custom_logo.style, {
				maxWidth:
					this.options.field_pixel_size <= 4 && !this.options.biglogo
						? '180px'
						: '260px',
				marginTop:
					this.options.field_pixel_size <= 4 && !this.options.biglogo
						? '-100px'
						: '-200px',
			});

			const small_nestrischamps_logo = document.createElement('img');
			small_nestrischamps_logo.src =
				this.options.field_pixel_size <= 4
					? '/brand/logo.v3.white.png'
					: '/brand/logo.v3.white.2x.png';

			Object.assign(small_nestrischamps_logo.style, {
				position: 'absolute',
				bottom: this.options.field_pixel_size <= 4 ? '35px' : '55px',
			});

			this.curtain_container.appendChild(custom_logo);
			this.curtain_container.appendChild(small_nestrischamps_logo);
		} else {
			const big_nestrischamps_logo = document.createElement('img');
			big_nestrischamps_logo.classList.add('logo');
			big_nestrischamps_logo.src =
				this.options.field_pixel_size < 4
					? '/brand/logo.v3.white.2x.png'
					: '/brand/logo.v3.white.3x.png';

			this.curtain_container.appendChild(big_nestrischamps_logo);
		}
	}

	_showCurtain() {
		if (!this.has_curtain) return;

		this._hideCurtain();
		this.curtain_viewport.hidden = false;

		const start_ts = Date.now();
		const duration = 1000;

		const steps = () => {
			const elapsed = Math.min(Date.now() - start_ts, duration);

			const top = easeOutQuart(
				elapsed,
				-this.bg_height,
				this.bg_height,
				duration
			);

			this.curtain_container.style.top = `${top}px`;

			if (elapsed < duration) {
				this.curtain_animation_ID = window.requestAnimationFrame(steps);
			} else {
				this.onCurtainDown();
			}
		};

		this.curtain_animation_ID = window.requestAnimationFrame(steps);
	}

	_hideCurtain() {
		if (!this.has_curtain) return;

		window.cancelAnimationFrame(this.curtain_animation_ID);

		this.curtain_viewport.hidden = true;
		this.curtain_container.style.top = `-${this.bg_height}px`;
	}

	_doTetris() {
		if (this.options.tetris_flash) {
			const start = Date.now();

			const steps = () => {
				const elapsed = (Date.now() - start) / 1000;
				const flashing = elapsed % (5 / 60) < 2 / 60; // flash for 2 "frame" every 5 "frames"
				let bg_color = flashing ? 'white' : 'rgba(0,0,0,0)';

				if (elapsed < 25 / 60) {
					this.tetris_animation_ID = window.requestAnimationFrame(steps);
				} else {
					// make sure we don't end on white
					bg_color = 'rgba(0,0,0,0)';
				}

				this.field_bg.style.background = bg_color;
			};

			this.tetris_animation_ID = window.requestAnimationFrame(steps);
		}

		if (this.options.tetris_sound) {
			this.sounds.tetris();
		}

		this.onTetris();
	}

	clearTetrisAnimation() {
		window.cancelAnimationFrame(this.tetris_animation_ID);
		this.clear_animation_remaining_frames = -1;
	}

	// to be invoked when player id changes
	_playerReset(id) {
		this._gameReset();
		this._resetFrameBuffer();
		this.setPeerId();

		this.camera_state = { mirror: 0 };

		if (id) {
			this._hideCurtain(); // we're expecting frames, so no need to show curtain
		}
	}

	// to be invoked in between Games
	_gameReset() {
		this.winner_frame = 0;

		this.preview_ctx.clear();
		this.field_ctx.clear();
		this.running_trt_ctx?.clear();

		this.clearTetrisAnimation();
		this.clearWinnerAnimation();
		this.field_bg.style.background = 'rbga(0,0,0,0)';

		this.dom.score.textContent = this.options.format_score(0);
		this.dom.lines.textContent = '000';
		this.dom.level.textContent = '00';
		this.dom.runway_tr.textContent = this.options.format_score(0, 6);
		this.dom.runway_game.textContent = this.options.format_score(0, 7);
		this.dom.projection.textContent = this.options.format_score(0, 7);
		this.dom.trt.textContent = '-';
		this.dom.eff.textContent = '-';
		this.dom.burn.textContent = 0;

		this._destroyGame();
		this._showCurtain();
	}

	setDiff(diff, t_diff) {
		// implement in subclasses
	}

	setGameRunwayDiff(diff, t_diff) {
		// implement in subclasses
	}

	setProjectionDiff(diff, t_diff) {
		// implement in subclasses
	}

	setAvatar(url) {
		this.avatar_url = url;
		this.avatar.style.backgroundImage = `url('${encodeURI(url)}')`;
	}

	setName(name) {
		this.player_name = name;

		if (name) {
			this.dom.name.textContent = name;
		} else {
			this.dom.name.innerHTML = '&nbsp;';
		}
	}

	setCameraState(camera_state) {
		this.camera_state = camera_state;
		if (camera_state?.mirror) {
			this.dom.video.style.transform = 'scale(-1, 1)';
		} else {
			this.dom.video.style.transform = null;
			delete this.dom.video.style.transform;
		}
	}

	setCountryCode(code) {
		if (!this.dom.flag) return;

		this.dom.flag.innerHTML = code
			? `<img id="country_flag" src="/vendor/country-flag-icons/3x2/${code}.svg">`
			: '';
	}

	setId(id) {
		this.id = id;
		this._playerReset(id);
	}

	setPeerId(peerid) {
		this.peerid = peerid;

		if (!peerid) {
			this.dom.video.srcObject = null;
		}
	}

	_refreshProfileCard() {
		if (this.login) {
			const rand = `${Math.random()}`.slice(2);
			this.profile_card.src = `/view/profile_card/${
				this.login
			}?r=${Date.now()}-${rand}`; // always refresh with cachebuster
		} else {
			this.profile_card.src = `/view/profile_card/NONE`; // allows caching
		}
	}

	setLogin(login) {
		this.login = login;
		this._refreshProfileCard();
	}

	createGame() {
		this._destroyGame();

		this.game = new BaseGame();

		// Handlers with local rendering actions
		this.game.onScore = this._renderScore;
		this.game.onPiece = this._renderPiece;
		this.game.onLines = this._renderLines;
		this.game.onLevel = this._renderLevel;
		this.game.onTransition = this._renderTransition;
		this.game.onNewGame = this._renderNewGame;
		this.game.onValidFrame = this._renderValidFrame;
		this.game.onTetris = this._doTetris;
		this.game.onGameOver = this._renderGameOver;

		// Pass-throughs handlers
		PASSTHROUGH_HANDLERS.forEach(on_name => {
			this.game[on_name] = (...args) => {
				this[on_name](...args);
			};
		});
	}

	_destroyGame() {
		if (!this.game) return;

		// Stop listening to any game events to prevent accidental rendering

		// Handlers with local rendering actions
		delete this.game.onScore;
		delete this.game.onPiece;
		delete this.game.onLines;
		delete this.game.onLevel;
		delete this.game.onNewGame;
		delete this.game.onValidFrame;
		delete this.game.onTetris;
		delete this.game.onGameOver;

		// Pass-throughs handlers
		PASSTHROUGH_HANDLERS.forEach(on_name => {
			delete this.game[on_name];
		});

		this.game = null;
	}

	setGame(game) {
		this._destroyGame();
		this.game = game;
	}

	_resetFrameBuffer() {
		if (this.frame_buffer) {
			this.frame_buffer.destroy();
		}

		if (this.options.buffer_time) {
			this.frame_buffer = new FrameBuffer(
				this.options.buffer_time,
				this._setFrameOuter
			);
		}
	}

	setFrame(data) {
		if (this.frame_buffer) {
			this.frame_buffer.setFrame(data);
		} else {
			this._setFrameOuter(data);
		}
	}

	// TODO: for the 3 getters below
	// Add ability to specify a frame, or timestamp
	getScore() {
		return this.game?.data?.score.current || 0;
	}

	getGameRunwayScore() {
		return this.game?.data?.score.runway || 0;
	}

	getProjection() {
		return this.game?.data?.score.projection || 0;
	}

	_setFrameOuter(data) {
		if (!this.game) {
			this._renderNewGame(data);
		} else {
			this.game.setFrame(data);
		}
	}

	_renderNewGame(frame) {
		this._gameReset();
		this._hideCurtain();
		this.createGame();
		this.game.setFrame(frame);

		const last_frame = peek(this.game.frames);

		this._renderScore(last_frame);
		this._renderLevel(last_frame);
		this._renderLines(last_frame);
		this._renderPiece(last_frame);

		if (this.ready) {
			this.showProfileCard(false);
		}

		this.ready = false;
	}

	_renderValidFrame(frame) {
		if (!this.game.over) {
			this.renderField(frame.raw.level, frame.raw.field);
			this.renderPreview(frame.raw.level, frame.raw.preview);
		}
	}

	_renderScore(frame) {
		const point_evt = peek(frame.points);

		this.dom.score.textContent = this.options.format_score(
			point_evt.score.current
		);

		if (point_evt.score.transition === null) {
			this.dom.runway_tr.textContent = this.options.format_score(
				point_evt.score.tr_runway,
				6
			);
		}

		this.dom.runway_game.textContent = this.options.format_score(
			point_evt.score.runway,
			7
		);

		this.dom.runway_lv19.textContent = this.options.format_score(
			point_evt.score.runways.LV19,
			6
		);
		this.dom.runway_lv29.textContent = this.options.format_score(
			point_evt.score.runways.LV29,
			7
		);
		this.dom.runway_lv39.textContent = this.options.format_score(
			point_evt.score.runways.LV39,
			7
		);
		this.dom.projection.textContent = this.options.format_score(
			point_evt.score.projection,
			7
		);

		this.onScore(frame);
	}

	_renderTransition(frame) {
		const point_evt = peek(frame.points);

		this.dom.runway_tr.textContent = this.options.format_score(
			point_evt.score.transition,
			6
		);

		this.onTransition(frame);
	}

	_renderLines(frame) {
		let clear_evt = peek(frame.clears);

		if (!clear_evt) clear_evt = fake_clear_evt;

		this.dom.lines.textContent = `${frame.raw.lines}`.padStart(3, '0');
		this.dom.burn.textContent = clear_evt.burn;

		if (frame.clears.length) {
			this.dom.trt.textContent = getPercent(clear_evt.tetris_rate);
			this.dom.eff.textContent = (Math.round(clear_evt.efficiency) || 0)
				.toString()
				.padStart(3, '0');

			this.renderRunningTRT(frame.clears);
		}

		this.onLines(frame);
	}

	_renderLevel(frame) {
		this.dom.level.textContent = `${frame.raw.level}`.padStart(2, '0');

		this.onLevel(frame);
	}

	_renderPiece(frame) {
		this.renderPreview(frame.raw.level, frame.raw.preview);

		let piece_evt = peek(frame.pieces);

		if (!piece_evt) piece_evt = fake_piece_evt;

		this.dom.drought.textContent = this.options.format_drought(
			piece_evt.i_droughts.cur
		);

		this.onPiece(frame);
	}

	_renderGameOver(frame) {
		if (frame) {
			this._renderScore(frame); // locks the runway and projection scores
		}

		this._showCurtain();
		this.onGameOver();
	}

	renderPreview(level, preview) {
		const piece_id = `${level}${preview}`;

		if (piece_id === this.current_preview) return;

		this.current_preview = piece_id;

		const ctx = this.preview_ctx,
			col_index = PIECE_COLORS[preview],
			pixels_per_block = this.preview_pixel_size * (7 + 1),
			positions = [];

		ctx.clear();

		let pos_x, pos_y, x_offset_3;

		if (this.options.preview_align == 'tr') {
			// top-right alignment
			pos_y = 0;
			x_offset_3 = Math.ceil(
				ctx.canvas.width - (3 * 8 - 1) * this.preview_pixel_size
			);
		} else {
			// default is center
			pos_y = Math.ceil(
				(ctx.canvas.height - (2 * 8 - 1) * this.preview_pixel_size) / 2
			);
			x_offset_3 = Math.ceil(
				(ctx.canvas.width - (3 * 8 - 1) * this.preview_pixel_size) / 2
			);
		}

		let x_idx = 0;

		switch (preview) {
			case 'I':
				if (this.options.preview_align == 'tr') {
					pos_x = Math.ceil(
						ctx.canvas.width - (4 * 8 - 1) * this.preview_pixel_size
					);
				} else {
					pos_x = Math.ceil(
						(ctx.canvas.width - (4 * 8 - 1) * this.preview_pixel_size) / 2
					);
					pos_y = Math.ceil(
						(ctx.canvas.height - (1 * 8 - 1) * this.preview_pixel_size) / 2
					);
				}

				positions.push([pos_x + 0 * pixels_per_block, pos_y]);
				positions.push([pos_x + 1 * pixels_per_block, pos_y]);
				positions.push([pos_x + 2 * pixels_per_block, pos_y]);
				positions.push([pos_x + 3 * pixels_per_block, pos_y]);
				break;

			case 'O':
				if (this.options.preview_align == 'tr') {
					pos_x = Math.ceil(
						ctx.canvas.width - (2 * 8 - 1) * this.preview_pixel_size
					);
				} else {
					pos_x = Math.ceil(
						(ctx.canvas.width - (2 * 8 - 1) * this.preview_pixel_size) / 2
					);
				}

				positions.push([pos_x, pos_y]);
				positions.push([pos_x, pos_y + pixels_per_block]);
				positions.push([pos_x + pixels_per_block, pos_y]);
				positions.push([pos_x + pixels_per_block, pos_y + pixels_per_block]);
				break;

			case 'T':
			case 'J':
			case 'L':
				// top line is the same for both pieces
				positions.push([x_offset_3 + 0 * pixels_per_block, pos_y]);
				positions.push([x_offset_3 + 1 * pixels_per_block, pos_y]);
				positions.push([x_offset_3 + 2 * pixels_per_block, pos_y]);

				if (preview == 'L') {
					x_idx = 0;
				} else if (preview == 'T') {
					x_idx = 1;
				} else {
					x_idx = 2; // J
				}

				positions.push([
					x_offset_3 + x_idx * pixels_per_block,
					pos_y + pixels_per_block,
				]);
				break;

			case 'Z':
			case 'S':
				positions.push([x_offset_3 + pixels_per_block, pos_y]);
				positions.push([
					x_offset_3 + pixels_per_block,
					pos_y + pixels_per_block,
				]);

				if (preview == 'Z') {
					positions.push([x_offset_3, pos_y]);
					positions.push([
						x_offset_3 + pixels_per_block * 2,
						pos_y + pixels_per_block,
					]);
				} else {
					positions.push([x_offset_3, pos_y + pixels_per_block]);
					positions.push([x_offset_3 + pixels_per_block * 2, pos_y]);
				}
		}

		positions.forEach(([pos_x, pos_y]) => {
			renderBlock(
				level,
				col_index,
				this.preview_pixel_size,
				ctx,
				pos_x,
				pos_y,
				true
			);
		});
	}

	renderField(level, field) {
		if (!this.options.draw_field) return;

		const pixels_per_block = this.field_pixel_size * (7 + 1);

		this.field_ctx.clear();

		for (let x = 0; x < 10; x++) {
			for (let y = 0; y < 20; y++) {
				renderBlock(
					level,
					field[y * 10 + x],
					this.field_pixel_size,
					this.field_ctx,
					x * pixels_per_block,
					y * pixels_per_block,
					true
				);
			}
		}
	}

	renderRunningTRT(clear_events) {
		if (!this.running_trt_ctx) return;

		const ctx = this.running_trt_ctx,
			current_trt = peek(clear_events).tetris_rate,
			pixel_size_line_clear = this.options.running_trt_dot_size,
			pixel_size_baseline = pixel_size_line_clear / 2;

		let pixel_size, max_pixels, y_scale;

		ctx.clear();

		// show the current tetris rate baseline
		// always vertically centered on the line clear event dot
		pixel_size = pixel_size_baseline;
		max_pixels = Math.ceil(ctx.canvas.width / (pixel_size + 1));
		y_scale = (ctx.canvas.height - pixel_size_line_clear) / pixel_size;

		const pos_y = Math.round(
			(1 - current_trt) * y_scale * pixel_size +
				(pixel_size_line_clear - pixel_size_baseline) / 2
		);

		ctx.fillStyle = 'grey'; // '#686868';

		for (let idx = max_pixels; idx--; ) {
			ctx.fillRect(idx * (pixel_size + 1), pos_y, pixel_size, pixel_size);
		}

		// Show the individual line clear events
		pixel_size = pixel_size_line_clear;
		max_pixels = Math.floor(ctx.canvas.width / (pixel_size + 1));
		y_scale = (ctx.canvas.height - pixel_size) / pixel_size;

		let to_draw = clear_events.slice(-1 * max_pixels),
			len = to_draw.length;

		for (let idx = len; idx--; ) {
			const { cleared, tetris_rate } = to_draw[idx];
			const color = LINES[cleared] ? LINES[cleared].color : 'grey';

			ctx.fillStyle = color;
			ctx.fillRect(
				idx * (pixel_size + 1),
				Math.round((1 - tetris_rate) * y_scale * pixel_size),
				pixel_size,
				pixel_size
			);
		}
	}

	clearField() {
		this.field_ctx.clear();
		this.clearWinnerAnimation();
		this._hideCurtain();
	}

	setGameOver() {
		this._renderGameOver();
		// this._lockRunWayToScore();
		if (this.game) {
			// This is not a true game over that locks the runway score 🤔
			this.game.over = true;
		}
	}

	cancelGameOver() {
		this.clearField();
		if (game) {
			this.game.over = false;
		}
	}

	showLoserFrame() {
		this.winner_frame = 0;
		this.clearField();
		this.renderLoserFace();
		this.renderBorder(false);

		if (this.game) {
			this.game.over = true;
		}
	}

	playWinnerAnimation() {
		// cancel rendering for current game
		if (this.game) {
			this.game.over = true;
		}

		this.winner_frame = 0;
		this.clearField();
		this.winner_animation_id = setInterval(this.renderWinnerFrame, 1000 / 18);
	}

	clearWinnerAnimation() {
		this.winner_animation_id = clearInterval(this.winner_animation_id);
	}

	renderWinnerFrame() {
		this.winner_frame++;
		this.renderWinnerFace();
		this.renderBorder(true);
	}

	renderWinnerFace() {
		const pixels_per_block = this.field_pixel_size * (7 + 1);
		const level = Math.floor(this.winner_frame / 3) % 10;

		WINNER_FACE_BLOCKS.forEach(([y, x]) => {
			renderBlock(
				level,
				1,
				this.field_pixel_size,
				this.field_ctx,
				x * pixels_per_block,
				y * pixels_per_block,
				true
			);
		});
	}

	renderLoserFace() {
		const pixels_per_block = this.field_pixel_size * (7 + 1);
		const level = 6;

		LOSER_FACE_BLOCKS.forEach(([y, x]) => {
			renderBlock(
				level,
				3,
				this.field_pixel_size,
				this.field_ctx,
				x * pixels_per_block,
				y * pixels_per_block,
				true
			);
		});
	}

	renderBorder(is_winner) {
		const pixels_per_block = this.field_pixel_size * (7 + 1);

		BORDER_BLOCKS.forEach(([y, x], idx) => {
			const offset = this.winner_frame + idx;

			let level, color;

			if (is_winner) {
				level = Math.floor(offset / 3) % 10;
				color = (offset % 3) + 1;
			} else {
				// ugly grey piece
				level = 6;
				color = 3;
			}

			renderBlock(
				level,
				color,
				this.field_pixel_size,
				this.field_ctx,
				x * pixels_per_block,
				y * pixels_per_block,
				true
			);
		});
	}
}
