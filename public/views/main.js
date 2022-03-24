import { peek } from '/views/utils.js';
import QueryString from '/js/QueryString.js';
import Connection from '/js/connection.js';
import DomRefs from '/views/DomRefs.js';
import renderBlock from '/views/renderBlock.js';
import BaseGame from '/views/BaseGame.js';

import {
	PIECES,
	LINES,
	DAS_COLORS,
	BOARD_COLORS,
	PIECE_COLORS,
	DROUGHT_PANIC_THRESHOLD,
	DAS_THRESHOLDS,
} from '/views/constants.js';

export const BLOCK_PIXEL_SIZE = 3;

const dom = new DomRefs(document);

// initial setup for colors based con constants.js
for (const { name, color } of Object.values(LINES)) {
	[...document.querySelectorAll(`tr.${name} th`)].forEach(
		node => (node.style.color = color)
	);
}

if (dom.das) {
	for (const [rating, color] of Object.entries(DAS_COLORS)) {
		const das_label = document.querySelector(`#das .${rating} .label`);

		if (!das_label) continue;

		das_label.style.color = color;
	}
}

for (const [type, color] of Object.entries(BOARD_COLORS)) {
	const label = document.querySelector(`#board_stats .${type}`);

	if (!label) continue;

	label.style.color = color;
}

const API = {
	message: onMessage,
	player_data: renderPastGamesAndPBs,
	frame: (idx, frame) => onFrame(frame),
};

/* check query string to see if video is active */

let connection;

try {
	connection = new Connection(null, view_meta); // sort of gross T_T
} catch (_err) {
	connection = new Connection();
}

connection.onMessage = function (frame) {
	try {
		let [method, ...args] = frame;

		API[method](...args);
	} catch (e) {
		console.error(e);
	}
};

if (QueryString.get('video') === '1') {
	const holder = document.querySelector('#video');
	const video = document.createElement('video');

	holder.innerHTML = '';
	holder.appendChild(video);

	let peer;

	connection.onInit = () => {
		if (peer) {
			peer.destroy();
			peer = null;
		}

		peer = new Peer(connection.id);

		peer.on('call', call => {
			call.answer(); // assume correct!
			call.on('stream', remoteStream => {
				video.srcObject = remoteStream;
				video.addEventListener(
					'loadedmetadata',
					() => {
						video.play();
					},
					{ once: true }
				);
			});
			call.on('error', () => {
				video.stop();
				video.srcObject = null;
			});
			call.on('close', () => {
				video.stop();
				video.srcObject = null;
			});
		});
	};
}

// get High Scores
getStats();

function onTetris() {
	let remaining_frames = 12;

	function steps() {
		const flash = --remaining_frames % 2;

		dom.stream_bg.element.style.backgroundColor = flash ? 'white' : null;

		if (remaining_frames > 0) {
			window.requestAnimationFrame(steps);
		}
	}

	window.requestAnimationFrame(steps);
}

const user_colors = {};

function getUserColor(username) {
	if (!(username in user_colors)) {
		user_colors[username] = `hsl(${~~(360 * Math.random())},${~~(
			80 +
			20 * Math.random()
		)}%,${~~(50 + 20 * Math.random())}%)`;
	}

	return user_colors[username];
}

function onMessage(entry) {
	const p = document.createElement('p');
	p.classList.add('message');

	const name = document.createElement('span');
	name.classList.add('name');
	name.textContent = entry.display_name;
	name.style.color = entry.color || getUserColor(entry.username);

	const divider = document.createElement('br');

	const msg = document.createElement('span');
	msg.classList.add('text');
	msg.textContent = entry.message;

	p.appendChild(name);
	p.appendChild(divider);
	p.appendChild(msg);

	dom.chat.element.appendChild(p);

	dom.chat.element.scrollTop =
		dom.chat.element.scrollHeight - dom.chat.element.clientHeight;
}

let game = null;

function onFrame(event, debug) {
	if (!game) createGame();

	game.setFrame(event);
}

function createGame() {
	game = new BaseGame();
	game.onScore = renderScore;
	game.onPiece = renderPiece;
	game.onLines = renderLines;
	game.onLevel = renderLevel;
	game.onNewgame = onNewGame;
	game.onValidFrame = onValidFrame;
	game.onTetris = () => onTetris();
	// game.onGameOver = ???
}

function onNewGame(frame) {
	createGame();
	game.setFrame(frame);
}

function onValidFrame(frame) {
	renderStage(frame);
	renderInstantDas(frame.raw.instant_das);
}

function getStats() {
	let m;

	if ((m = location.pathname.match(/^\/view\/[a-z0-9_-]+\/([a-zA-Z0-9]+)$/))) {
		fetch(`${location.protocol}//${location.host}/stats/get_stats/${m[1]}`, {
			cache: 'no-cache',
			headers: {
				'Cache-Control': 'no-cache',
			},
			// mode: 'no-cors'
		})
			.then(response => response.json())
			.then(renderPastGamesAndPBs)
			.catch(console.error); // noop
	}
}

function clearStage() {
	dom.droughts.cur.ctx.clear();
	dom.droughts.last.ctx.clear();
	dom.droughts.max.ctx.clear();

	dom.pieces.element.classList.remove(
		'l0',
		'l1',
		'l2',
		'l3',
		'l4',
		'l5',
		'l6',
		'l7',
		'l8',
		'l9'
	);
	dom.next.element.classList.remove(
		'l0',
		'l1',
		'l2',
		'l3',
		'l4',
		'l5',
		'l6',
		'l7',
		'l8',
		'l9'
	);

	stage_currently_rendered = null;
	next_piece_currently_rendered = null;
}

function renderPastGamesAndPBs(data) {
	// pbs
	data.pbs.forEach(record => {
		if (!record) return;

		const row = dom.pbs[`s${record.start_level}`];

		if (!row) return;

		row.end_level.textContent = (record.end_level || 0)
			.toString()
			.padStart(2, '0');
		row.score.textContent = (record.score || 0)
			.toString()
			.padStart(6, '0')
			.padStart(7, ' ');
		row.lines.textContent = (record.lines || 0).toString().padStart(3, '0');
		row.tetris_rate.textContent = getPercent(record.tetris_rate || 0);

		if (row.das_avg) {
			row.das_avg.textContent = (record.das_avg || 0)
				.toFixed(1)
				.padStart(4, '0');
		}

		if (row.max_drought) {
			row.max_drought.textContent = (record.max_drought || 0)
				.toString()
				.padStart(3, '0');
		}
	});

	// Disgusting hardcoded values below T_T
	const num_scores_to_show =
		dom.high_scores.element.clientHeight > 200 ? 10 : 5;

	// high scores
	['today', 'overall'].forEach(category => {
		if (data.high_scores[category].length <= 0) {
			data.high_scores[category].push(null);
		}

		dom.high_scores[category].innerHTML = data.high_scores[category]
			.slice(0, num_scores_to_show)
			.map(record => {
				if (!record || record.start_level == null) {
					record = {
						score: 0,
						tetris_rate: 0,
						start_level: 0,
					};
				}

				return (
					'<tr>' +
					[
						(record.start_level || 0).toString().padStart(2, '0'),
						(record.score || 0).toString().padStart(6, '0').padStart(7, ' '),
						getPercent(record.tetris_rate || 0),
					]
						.map(content => `<td>${content}</td>`)
						.join('') +
					'</tr>'
				);
			})
			.join('');
	});
}

function renderScore(frame) {
	const point_evt = peek(frame.points);

	dom.score.current.textContent = point_evt.score.current
		.toString()
		.padStart(6, '0')
		.padStart(7, ' ');

	if (dom.runway) {
		if (point_evt.score.transition === null) {
			dom.runway.header.textContent = 'TRAN RUNWAY';
			dom.runway.value.textContent = point_evt.score.tr_runway.toString();
		} else {
			dom.runway.header.textContent = 'GAME RUNWAY';
			dom.runway.value.textContent = point_evt.score.runway.toString();
		}
	}

	// could be moved to a different method renderTransition()
	if (point_evt.score.transition) {
		dom.score.transition.textContent = point_evt.score.transition
			.toString()
			.padStart(6, '0')
			.padStart(7, ' ');
	} else {
		dom.score.transition.textContent = '------';
	}

	// Update points by clear type (and drops)
	// Necessary because percentage of each change at every point increase
	dom.points.count.textContent = point_evt.score.current;

	for (const [num_lines, values] of Object.entries(LINES)) {
		const { name } = values;

		dom.points[name].count.textContent = point_evt.points[num_lines].count
			.toString()
			.padStart(6, '0')
			.padStart(7, ' ');
		dom.points[name].percent.textContent = getPercent(
			point_evt.points[num_lines].percent
		);
	}

	dom.points.drops.count.textContent = point_evt.points.drops.count
		.toString()
		.padStart(6, '0')
		.padStart(7, ' ');
	dom.points.drops.percent.textContent = getPercent(
		point_evt.points.drops.percent
	);
}

function renderLines(frame) {
	const clear_evt = peek(frame.clears);

	// Do the small boxes first
	dom.tetris_rate.value.textContent = getPercent(clear_evt.tetris_rate);
	dom.efficiency.value.textContent = (Math.floor(clear_evt.efficiency) || 0)
		.toString()
		.padStart(3, '0');
	dom.burn.count.textContent = clear_evt.burn.toString().padStart(2, '0');

	const line_count = frame.raw.lines.toString().padStart(3, '0');

	if (dom.lines) {
		dom.lines.count.textContent = line_count;
	}

	dom.lines_stats.count.textContent = line_count;

	for (const [num_lines, values] of Object.entries(LINES)) {
		const { name } = values;

		dom.lines_stats[name].count.textContent = clear_evt.lines[num_lines].count
			.toString()
			.padStart(3, '0');
		dom.lines_stats[name].lines.textContent = clear_evt.lines[num_lines].lines
			.toString()
			.padStart(3, '0');
		dom.lines_stats[name].percent.textContent = getPercent(
			clear_evt.lines[num_lines].percent
		);
	}

	// Update running tetris rate graph
	const trt_ctx = dom.lines_stats.trt_ctx,
		pixel_size = 4,
		max_pixels = Math.floor(trt_ctx.canvas.width / (pixel_size + 1)),
		y_scale = (trt_ctx.canvas.height - pixel_size) / pixel_size,
		to_draw = frame.clears.slice(-1 * max_pixels);

	trt_ctx.clear();

	for (let idx = to_draw.length; idx--; ) {
		const { cleared, tetris_rate } = to_draw[idx];

		trt_ctx.fillStyle = LINES[cleared].color;
		trt_ctx.fillRect(
			idx * (pixel_size + 1),
			Math.round((1 - tetris_rate) * y_scale * pixel_size),
			pixel_size,
			pixel_size
		);
	}
}

function renderLevel(frame) {
	dom.level.value.textContent = frame.raw.level.toString().padStart(2, '0');

	// Level update for
	dom.pieces.element.classList.remove(`l${(frame.raw.level - 1) % 10}`);
	dom.pieces.element.classList.add(`l${frame.raw.level % 10}`);

	dom.next.element.classList.remove(`l${(frame.raw.level - 1) % 10}`);
	dom.next.element.classList.add(`l${frame.raw.level % 10}`);

	// TODO: Do transition warning
	game.onTransitionWarning = warning_lines => {
		commentate(
			`${game.transition_lines - game.data.lines.count} lines till transition`
		);
	};
}

function renderPiece(frame) {
	const piece_evt = peek(frame.pieces);

	dom.pieces.count.textContent = frame.pieces.length
		.toString()
		.padStart(3, '0');

	// Render deviation data
	dom.pieces.deviation.textContent = (piece_evt.deviation * 100).toFixed(1);
	dom.pieces.deviation_28.textContent = (piece_evt.deviation_28 * 100).toFixed(
		1
	);
	dom.pieces.deviation_56.textContent = (piece_evt.deviation_56 * 100).toFixed(
		1
	);

	// Render piece distribution graphs
	let pixel_size = 4,
		max_pixels = Math.floor(dom.pieces.T.ctx.canvas.width / (pixel_size + 1)),
		draw_start = Math.max(0, frame.pieces.length - max_pixels);

	PIECES.forEach(name => {
		const piece_data = game.data.pieces[name],
			ctx = dom.pieces[name].ctx,
			indexes = piece_data.indexes,
			drought_color = name == 'I' ? 'orange' : '#747474';

		dom.pieces[name].count.textContent = piece_data.count
			.toString()
			.padStart(3, '0');
		dom.pieces[name].drought.textContent = piece_data.drought
			.toString()
			.padStart(2, '0');
		dom.pieces[name].percent.textContent = getPercent(piece_data.percent);

		ctx.resetTransform();
		ctx.clear();
		ctx.transform(1, 0, 0, 1, -draw_start * (pixel_size + 1), 0);

		for (let idx = 0; idx < indexes.length; idx++) {
			const piece_idx = indexes[idx].index,
				das = indexes[idx].das,
				color = DAS_COLORS[DAS_THRESHOLDS[das]];

			ctx.fillStyle = color;
			ctx.fillRect(piece_idx * (pixel_size + 1), 0, pixel_size, pixel_size);

			const last_piece_idx = idx > 0 ? indexes[idx - 1].index : -1;

			if (piece_idx - last_piece_idx - 1 < DROUGHT_PANIC_THRESHOLD) {
				continue;
			}

			ctx.fillStyle = drought_color;
			ctx.fillRect(
				(last_piece_idx + 1) * (pixel_size + 1),
				0,
				(piece_idx - last_piece_idx - 1) * (pixel_size + 1) - 1,
				pixel_size
			);
		}

		// handle current drought if necessary
		if (piece_data.drought >= DROUGHT_PANIC_THRESHOLD) {
			// TODO: animate drought bar from 0 to DROUGHT_PANIC_THRESHOLD
			let start_x = 0;

			if (indexes.length) {
				start_x = (indexes[indexes.length - 1].index + 1) * (pixel_size + 1);
			}

			ctx.fillStyle = drought_color;
			ctx.fillRect(
				start_x,
				0,
				piece_data.drought * (pixel_size + 1) - 1,
				pixel_size
			);
		}
	});

	// Render droughts
	dom.droughts.count.textContent = frame.i_droughts.count
		.toString()
		.padStart(3, '0');
	dom.droughts.cur.value.textContent = frame.i_droughts.cur
		.toString()
		.padStart(2, '0');
	dom.droughts.last.value.textContent = frame.i_droughts.last
		.toString()
		.padStart(2, '0');
	dom.droughts.max.value.textContent = frame.i_droughts.max
		.toString()
		.padStart(2, '0');

	pixel_size = 2;
	max_pixels = Math.floor(dom.droughts.cur.ctx.canvas.width / (pixel_size + 1));

	const color = 'orange',
		cur_drought = frame.i_droughts.cur,
		cur_ctx = dom.droughts.cur.ctx,
		last_drought = frame.i_droughts.last,
		last_ctx = dom.droughts.last.ctx,
		max_drought = frame.i_droughts.max,
		max_ctx = dom.droughts.max.ctx;

	if (cur_drought > 0) {
		if (cur_drought <= max_pixels) {
			cur_ctx.fillStyle = color;
			cur_ctx.fillRect(
				(cur_drought - 1) * (pixel_size + 1),
				0,
				pixel_size,
				cur_ctx.canvas.height
			);
		}

		if (max_drought === cur_drought) {
			// draw the same block current has
			max_ctx.fillStyle = color;
			max_ctx.fillRect(
				(max_drought - 1) * (pixel_size + 1),
				0,
				pixel_size,
				max_ctx.canvas.height
			);
		}
	} else {
		// clear current but not max (only a new game would clear max)
		cur_ctx.clear();
	}

	// we clear and redraw the last gauge,
	// could be optimize by storing previous value and redraw on change,
	// but this will do for now
	last_ctx.clear();
	last_ctx.fillStyle = color;
	for (let idx = Math.min(last_drought, max_pixels); idx-- > 0; ) {
		last_ctx.fillRect(
			idx * (pixel_size + 1),
			0,
			pixel_size,
			last_ctx.canvas.height
		);
	}

	if (frame.i_droughts.cur >= DROUGHT_PANIC_THRESHOLD) {
		if (frame.i_droughts.max == frame.i_droughts.cur) {
			dom.droughts.element.classList.remove('panic');
			dom.droughts.element.classList.add('max_panic'); // doing this to synchronize animation - not working! -_-'
		} else {
			dom.droughts.element.classList.remove('max_panic');
			dom.droughts.element.classList.add('panic');
		}
	} else {
		dom.droughts.element.classList.remove('max_panic');
		dom.droughts.element.classList.remove('panic');
	}

	// das
	renderDasNBoardStats(frame);

	renderNextPiece(frame.raw.level, frame.raw.preview);
}

function renderInstantDas(das) {
	if (!dom.das) return;
	if (das == null || das === undefined || das < 0) return;

	dom.das.instant.textContent = das.toString().padStart(2, '0');

	const ctx = dom.das.gauge_ctx,
		pixel_size = 3,
		height = dom.das.gauge_ctx.canvas.height;

	// TODO: optimize!
	ctx.clear();

	ctx.fillStyle = 'orange';

	for (let idx = das; idx--; ) {
		ctx.fillRect(idx * (pixel_size + 1), 0, pixel_size, height);
	}
}

function renderDasNBoardStats(frame) {
	const piece_evt = peek(frame.pieces);

	// Function assumes same width for das and board stats
	// Both das and board stats are renderered in the same function to share the iteration loop
	// We could separate this to be clearer (loop should be actually quite cheap)

	if (dom.das) {
		dom.das.avg.textContent = piece_evt.das.avg.toFixed(1).padStart(4, '0');
		dom.das.great.textContent = piece_evt.das.great.toString().padStart(3, '0');
		dom.das.ok.textContent = piece_evt.das.ok.toString().padStart(3, '0');
		dom.das.bad.textContent = piece_evt.das.bad.toString().padStart(3, '0');

		dom.das.ctx.clear();
	}

	dom.board_stats.ctx.clear();

	const pixel_size = 4,
		max_pixels = Math.floor(
			dom.board_stats.ctx.canvas.width / (pixel_size + 1)
		),
		to_draw = frame.pieces.slice(-1 * max_pixels);

	let cur_x = 0;

	dom.board_stats.ctx.fillStyle = BOARD_COLORS.floor;
	dom.board_stats.ctx.fillRect(0, 60, dom.board_stats.ctx.canvas.width, 1);

	for (let idx = 0; idx < to_draw.length; idx++) {
		const piece = to_draw[idx];

		if (dom.das) {
			const das = piece.das,
				color = DAS_COLORS[DAS_THRESHOLDS[das]];

			if (piece.das_loss) {
				dom.das.ctx.fillStyle = '#550000';
				dom.das.ctx.fillRect(
					idx * (pixel_size + 1),
					0,
					pixel_size,
					pixel_size * 17
				);
			}

			dom.das.ctx.fillStyle = color;
			dom.das.ctx.fillRect(
				idx * (pixel_size + 1),
				(16 - das) * (pixel_size - 1),
				pixel_size,
				pixel_size
			);
		}

		const board_stats = piece.board;

		// draw line clear event in between pieces
		if (piece.clear && piece.clear.cleared) {
			dom.board_stats.ctx.fillStyle =
				LINES[piece.lines.num_lines].color || '#555';

			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) + pixel_size,
				0,
				1,
				60
			);
		}

		dom.board_stats.ctx.fillStyle = BOARD_COLORS.height;

		for (let yidx = 20; yidx-- > board_stats.top_idx; ) {
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1),
				yidx * (pixel_size - 1),
				pixel_size,
				2
			);
		}

		if (board_stats.tetris_ready) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.tetris_ready;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				62,
				pixel_size + 1,
				pixel_size
			);
		}

		if (board_stats.clean_slope) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.clean_slope;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				67,
				pixel_size + 1,
				pixel_size
			);
		}

		if (board_stats.double_well) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.double_well;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				72,
				pixel_size + 1,
				pixel_size
			);
		}

		if (piece.in_drought) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.drought;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				77,
				pixel_size + 1,
				pixel_size
			);
		}
	}
}

let last_level, last_field;

function renderStage(frame) {
	// If no change, don't draw
	if (
		frame.raw.level === last_level &&
		frame.raw.field.every((cell, idx) => cell === last_field[idx])
	)
		return;

	last_level = frame.raw.level;
	last_field = frame.raw.field;

	const ctx = dom.stage.ctx,
		pixels_per_block = BLOCK_PIXEL_SIZE * (7 + 1),
		field = frame.raw.field;

	ctx.clear();

	for (let x = 0; x < 10; x++) {
		for (let y = 0; y < 20; y++) {
			renderBlock(
				last_level,
				last_field[y * 10 + x],
				BLOCK_PIXEL_SIZE,
				ctx,
				x * pixels_per_block,
				y * pixels_per_block
			);
		}
	}
}

let next_piece_currently_rendered = null;

function renderNextPiece(level, next_piece) {
	if (level === null || !next_piece) {
		return;
	}

	const piece_id = `${level}${next_piece}`;

	if (piece_id === next_piece_currently_rendered) return;

	next_piece_currently_rendered = piece_id;

	const ctx = dom.next.ctx,
		col_index = PIECE_COLORS[next_piece],
		pixels_per_block = BLOCK_PIXEL_SIZE * (7 + 1),
		x_offset_3 = Math.floor(
			(ctx.canvas.width - pixels_per_block * 3 + BLOCK_PIXEL_SIZE) / 2
		),
		positions = [];

	ctx.clear();

	let pos_x = 0,
		pos_y = 0,
		x_idx = 0;

	switch (next_piece) {
		case 'I':
			pos_y = Math.floor((ctx.canvas.height - BLOCK_PIXEL_SIZE * 7) / 2);

			positions.push([x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_idx++ * pixels_per_block, pos_y]);
			break;

		case 'O':
			pos_x = Math.floor(
				(ctx.canvas.width - pixels_per_block * 2 + BLOCK_PIXEL_SIZE) / 2
			);

			positions.push([pos_x, pos_y]);
			positions.push([pos_x, pos_y + pixels_per_block]);
			positions.push([pos_x + pixels_per_block, pos_y]);
			positions.push([pos_x + pixels_per_block, pos_y + pixels_per_block]);
			break;

		case 'T':
		case 'J':
		case 'L':
			// top line is the same for both pieces
			positions.push([x_offset_3 + x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_offset_3 + x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_offset_3 + x_idx++ * pixels_per_block, pos_y]);

			if (next_piece == 'L') {
				x_idx = 0;
			} else if (next_piece == 'T') {
				x_idx = 1;
			} else {
				x_idx = 2;
			}

			positions.push([
				x_offset_3 + x_idx * pixels_per_block,
				pos_y + pixels_per_block,
			]);
			break;

		case 'Z':
		case 'S':
			positions.push([x_offset_3 + pixels_per_block, pos_y]);
			positions.push([x_offset_3 + pixels_per_block, pos_y + pixels_per_block]);

			if (next_piece == 'Z') {
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
		renderBlock(level, col_index, BLOCK_PIXEL_SIZE, ctx, pos_x, pos_y);
	});
}

const VOICES_DELAY = 100;
let acquire_voices_tries = 10;
let voice = null;

function getVoices() {
	if (!window.speechSynthesis) return;

	const all_voices = window.speechSynthesis.getVoices();

	if (all_voices.length <= 0) {
		if (acquire_voices_tries--) {
			setTimeout(getVoices, VOICES_DELAY);
		} else {
			console.log('Unable to get voices');
		}

		return;
	}

	// Samantha commentates!
	voice = all_voices.find(v => v.name.toLowerCase() === 'samantha');
}

function commentate(message) {
	if (!voice) return;

	const utterance = new SpeechSynthesisUtterance(message);
	utterance.voice = voice;
	utterance.rate = 1.05;

	window.speechSynthesis.speak(utterance);
}

if (QueryString.get('commentate') === '1') {
	getVoices();
}

export function setOnTetris(func) {
	onTetris = func;
}
