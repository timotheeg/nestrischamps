import BaseGame from '/views/BaseGame.js';
import QueryString from '/js/QueryString.js';
import BinaryFrame from '/js/BinaryFrame.js';
import Board from '/views/Board.js';
import { peek } from '/views/utils.js';

function noop() {}

let manageReplay = noop;

const URL_REPLAY_RE = /^\/replay\/([a-z0-9_-]+)\/((\d+)(-(\d+)){0,4})/;

const match = document.location.pathname.match(URL_REPLAY_RE);

// Playback tracking variables
let playing = false,
	games,
	reference_game,
	reference_frame,
	refs,
	autoplay = true,
	time_scale = 1,
	start_ctime,
	start_time,
	start_ts = 0,
	showFrame,
	play_timeout;

// URL variables for deeplinking variable control
if (/^[12345]$/.test(QueryString.get('speed'))) {
	time_scale = parseInt(QueryString.get('speed'), 10);
}
if (QueryString.get('autoplay') === '0') {
	autoplay = false;
}
if (/^[1-9]\d+$/.test(QueryString.get('ts'))) {
	start_ts = parseInt(QueryString.get('ts'), 10);
}

const use_piece_stats = QueryString.get('use_piece_stats') === '1';

export async function getReplayGame(gameid) {
	const game_url = `/api/games/${gameid}`;
	console.log(`Fetching game data for gameid ${gameid}`);

	const gamedata_res = await fetch(game_url);
	const gamedata = await gamedata_res.json();

	if (!gamedata.frame_url) {
		return { gamedata };
	}

	console.log(`Fetching game file at url ${gamedata.frame_url}`);
	const response = await fetch(gamedata.frame_url);
	const blob = await response.blob();
	const buffer = new Uint8Array(await blob.arrayBuffer());
	const version = buffer[0] >> 5 || 1;
	const frame_size = BinaryFrame.FRAME_SIZE_BY_VERSION[version];

	console.log({
		header: buffer[0].toString(2).padStart(8, '0'),
		version,
		frame_size,
	});

	const game = new BaseGame({});
	game._gameid = gameid; // game has a client id, this records the server id too, can be used later on

	const then = Date.now();
	let idx = 0;

	console.log(`Populating game`);
	while (idx < buffer.length) {
		const binary_frame = buffer.slice(idx, idx + frame_size);
		const frame_data = BinaryFrame.parse(binary_frame);
		game.setFrame(frame_data);
		idx += frame_size;
	}

	console.log(
		`Done parsing game ${gameid} with ${game.frames.length} frames in ${
			Date.now() - then
		}ms.`
	);

	return {
		gamedata,
		game,
	};
}

async function startReplay(_showFrame) {
	showFrame = _showFrame;

	const gameids = match[2].split('-');

	games = await Promise.all(gameids.map(getReplayGame).map(res => res.game));

	// sort by duration descending to find the longest game
	reference_game = [...games].sort((a, b) =>
		b.duration > a.duration ? 1 : -1
	)[0];

	const game_duration =
		peek(reference_game.frames).raw.ctime - reference_game.frames[0].raw.ctime;

	refs = addReplayControl();

	refs.playhead.min = 0;
	refs.playhead.max = game_duration;
	refs.playhead.step = 1;
	refs.playhead.value = 0;

	console.log('start_ts', start_ts);

	if (start_ts <= 0) {
		reference_frame = reference_game.frames[0];
	} else {
		reference_frame = reference_game.getFrameAtElapsed(start_ts);
	}

	refs.playhead.onclick = evt => {
		pause();
	};
	refs.playhead.onchange = evt => {
		doFrame(parseInt(refs.playhead.value, 10));
	};

	refs.play.onclick = play;
	refs.pause.onclick = pause;
	refs.prevframe.onclick = prevFrame;
	refs.nextframe.onclick = nextFrame;
	refs.prevpiece.onclick = getPrevByType('pieces');
	refs.nextpiece.onclick = getNextByType('pieces');
	refs.prevclear.onclick = getPrevByType('clears');
	refs.nextclear.onclick = getNextByType('clears');
	refs.slower.onclick = slower;
	refs.faster.onclick = faster;
	refs.stackrabbit.onclick = askStackRabbit;
	refs.getlink.onclick = getLink;

	if (autoplay) play();
}

function addReplayControl() {
	const cssFile = document.createElement('link');
	cssFile.rel = 'stylesheet';
	cssFile.type = 'text/css';
	cssFile.href = '/views/replay.css';
	document.head.appendChild(cssFile);

	const dom_refs = {};

	const container = document.createElement('div');
	container.id = 'replay';

	const replay_buttons = document.createElement('div');
	replay_buttons.className = 'buttons';

	const replay_timeline = document.createElement('div');
	replay_timeline.className = 'timeline';

	[
		['prevclear', '<< Clear'],
		['prevpiece', '<< Piece'],
		['prevframe', '< Frame'],
		['slower', 'Slower'],
		['play', 'Play'],
		['pause', 'Pause'],
		['faster', 'Faster'],
		['nextframe', 'Frame >'],
		['nextpiece', 'Piece >>'],
		['nextclear', 'Clear >>'],
		['stackrabbit', 'Ask StackRabbit'],
		['getlink', 'Get Link'],
	].forEach(([id, text]) => {
		const button = document.createElement('button');
		button.classList.add(id);
		button.innerText = text;

		dom_refs[id] = button;

		replay_buttons.appendChild(button);
	});

	const playhead = document.createElement('input');
	playhead.type = 'range';
	replay_timeline.appendChild(playhead);

	dom_refs.playhead = playhead;

	container.appendChild(replay_buttons);
	container.appendChild(replay_timeline);
	document.body.appendChild(container);

	return dom_refs;
}

function play() {
	if (reference_frame === peek(reference_game.frames)) {
		reference_frame = reference_game.frames[0];
	}

	playing = true;
	refs.play.hidden = true;
	refs.pause.hidden = false;

	refs.stackrabbit.disabled = true;
	refs.getlink.disabled = true;
	refs.prevframe.disabled = true;
	refs.nextframe.disabled = true;
	refs.prevpiece.disabled = true;
	refs.nextpiece.disabled = true;
	refs.prevclear.disabled = true;
	refs.nextclear.disabled = true;

	// align playback to current time
	const cur_ctime = reference_frame.raw.ctime;
	const cur_time = Date.now();

	start_ctime = reference_game.frames[0].raw.ctime;
	start_time = cur_time - (cur_ctime - start_ctime) / time_scale;

	showNextFrame();
}

function pause() {
	playing = false;
	refs.play.hidden = false;
	refs.pause.hidden = true;

	refs.getlink.disabled = false;

	play_timeout = clearTimeout(play_timeout);

	doFrame(getElapsedFromReference(reference_frame));
}

function nextFrame() {
	const next_frame = reference_game.frames[reference_frame.idx + 1];
	doFrame(getElapsedFromReference(next_frame));
}

function prevFrame() {
	const prev_frame = reference_game.frames[reference_frame.idx - 1];
	doFrame(getElapsedFromReference(prev_frame));
}

function getNextByType(type) {
	return function next() {
		if (reference_frame[type].length >= reference_game[type].length) return;

		let frame_idx = reference_frame.idx;
		while (
			reference_frame[type].length ===
			reference_game.frames[++frame_idx][type].length
		);

		const next_frame = reference_game.frames[frame_idx];
		doFrame(getElapsedFromReference(next_frame));
	};
}

function getPrevByType(type) {
	return function prev() {
		let prev_frame;
		if (reference_frame[type].length <= 1) {
			prev_frame = reference_game.frames[0];
		} else {
			let frame_idx = reference_frame.idx;

			// first go to first frame of current piece count
			while (
				reference_frame[type].length ===
				reference_game.frames[--frame_idx][type].length
			);
			while (
				reference_frame[type].length - 1 ===
				reference_game.frames[--frame_idx][type].length
			);

			prev_frame = reference_game.frames[frame_idx + 1];
		}

		doFrame(getElapsedFromReference(prev_frame));
	};
}

async function askStackRabbit() {
	refs.stackrabbit.disabled = true;

	const then = Date.now();
	const piece_evt = peek(reference_frame.pieces); // this reference will never change in a game, so it's safe to mutate it later even if the playhead has moved.
	const url = new URL(`${document.location.origin}/api/recommendation`);

	const board = new Board(piece_evt.field);

	const params = {
		level: reference_frame.raw.level <= 18 ? 18 : 19,
		lines: reference_frame.raw.lines,
		reactionTime: 24, // this is 400ms delay
		inputFrameTimeline: 'X....', // this is 12 Hz, should put 10 for NTSC DAS :/
		currentPiece: piece_evt.piece,
		nextPiece: reference_frame.raw.preview,
		board: board.rows
			.reduce((acc, row) => (acc.push(...row.cells), acc), [])
			.map(cell => (cell ? 1 : 0))
			.join(''),
	};

	Object.entries(params).forEach(([key, value]) =>
		url.searchParams.append(key, value)
	);

	console.log(url.toString());
	const res = await fetch(url);
	console.log(`Fetched StackRabbit recommendation in ${Date.now() - then}ms.`);
	const data = await res.text();
	console.log(`Extracted recommendation in ${Date.now() - then}ms: ${data}`);

	refs.stackrabbit.disabled = false;

	const match = data.match(/^(-?\d+),(-?\d+),(\d+)\|/);
	if (match) {
		piece_evt.recommendation = [
			parseInt(match[1], 10), // rotation (right!)
			parseInt(match[2], 10), // x shift
			parseInt(match[3], 10), // y shift
		];
	}

	doFrame(getElapsedFromReference(reference_frame));
}

function getLink() {
	const ts = getElapsedFromReference(reference_frame);
	let href = document.location.href;

	if (/[?&]ts=\d+/.test(href)) {
		href = href.replace(/([?&])ts=\d+/, `$1ts=${ts}`);
	} else if (href.includes('?')) {
		href += `&ts=${ts}`;
	} else {
		href += `?ts=${ts}`;
	}

	// fire and forget!
	navigator.clipboard.writeText(href);
}

function faster() {
	// some complication here :(
	// changing the time scale needs to change the reference start_time too.

	if (time_scale >= 1) {
		time_scale += 1;
	} else {
		time_scale = Math.min(1, time_scale * 2);
	}

	pause();
	play();
}

function slower() {
	// some complication here :(
	// changing the time scale needs to change the reference start_time too.

	if (time_scale > 1) {
		time_scale -= 1;
	} else {
		time_scale /= 2;
	}

	pause();
	play();
}

function getElapsedFromReference(frame) {
	return frame.raw.ctime - reference_game.frames[0].raw.ctime;
}

function doFrame(ms) {
	reference_frame = reference_game.getFrameAtElapsed(ms);

	showFrame(reference_frame);

	refs.playhead.value = getElapsedFromReference(reference_frame);
	refs.playhead.title = refs.playhead.value;

	if (!playing) {
		refs.nextframe.disabled =
			ms >= getElapsedFromReference(peek(reference_game.frames));
		refs.prevframe.disabled = ms <= 0;
		refs.nextpiece.disabled =
			reference_frame.pieces.length >= reference_game.pieces.length;
		refs.prevpiece.disabled = reference_frame.pieces.length < 1;
		refs.nextclear.disabled =
			reference_frame.clears.length >= reference_game.clears.length;
		refs.prevclear.disabled = reference_frame.clears.length < 1;
		refs.stackrabbit.disabled =
			reference_frame.in_clear_animation ||
			(peek(reference_frame.pieces) &&
				peek(reference_frame.pieces).recommendation) ||
			reference_frame.pieces.length >= reference_game.pieces.length;
	}
}

function showNextFrame() {
	if (play_timeout) return;
	if (reference_frame === peek(reference_game.frames)) {
		// done!
		pause();
		return;
	}

	const next_frame = reference_game.frames[reference_frame.idx + 1];
	const next_ctime = next_frame.raw.ctime;
	const tdiff = Math.round((next_ctime - start_ctime) / time_scale);

	const next_time = start_time + tdiff;
	const send_delay = Math.max(0, next_time - Date.now());

	play_timeout = setTimeout(() => {
		play_timeout = null;
		doFrame(getElapsedFromReference(next_frame));
		showNextFrame();
	}, send_delay);
}

if (match) {
	manageReplay = startReplay;
}

export default manageReplay;
