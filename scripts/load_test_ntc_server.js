import fs from 'fs';
import { WebSocket } from 'ws';
import BinaryFrame from '../public/js/BinaryFrame.js';
import BaseGame from '../public/views/BaseGame.js';
import { peek, shuffle } from '../public/views/utils.js';
import { Worker, isMainThread, workerData } from 'worker_threads';
import zlib from 'zlib';

// Behaviour:
// 1 driver process
// multiple worker process to send d=the data stream
// because it's io load, actually, subprocesses may not be needed, but good opportunity to learn to use them

// start 4 independent node processes, 8 player per process
// OR 8 independent processes, 4 player per process?

/*
input args:
server domain: e.g. 'nestrischamps.io', '192.168.6.102:5000'
send games continuously with 10s pause in betwen each game...
/**/

const localGameFiles = [
	'ericicx_3M.ngf',
	'gamescout_941k.ngf',
	'jounce_1.6M.ngf',
	'yobi_777k.ngf',
];

let localGames = [];

function runDriver() {
	const server_domain = process.argv[2]; // assume correct

	if (!server_domain) {
		console.error('Please supply the server domain in CLI invocation');
		process.exit(1);
	} else {
		console.log(`import.meta: ${import.meta.url}`);
	}

	const workers = [1, 2, 3, 4].map(host_num => {
		return new Worker(new URL(import.meta.url), {
			workerData: {
				host_num,
				server_domain,
			},
		});
	});
}

class Player {
	constructor(server_domain, host_num, player_num) {
		this.identifier = [host_num, player_num];
		console.log(`${this.identifier} CONSTRUCTION`);

		this.games = shuffle([...localGames]);

		const host_login = `player${host_num}`;
		const player_secret = `PLAYER${player_num}`;
		const ws_url = `ws://${server_domain}/ws/room/u/${host_login}/producer/${player_secret}`;

		console.log(ws_url);

		const ws = (this.ws = new WebSocket(ws_url, {
			perMessageDeflate: false,
		}));

		ws.on('open', () => {
			console.log(`${this.identifier} OPEN`);
			setTimeout(() => {
				this.nextGame();
			}, 500);
		});
		ws.on('error', console.error);
		ws.on('message', data => {
			// console.log(`${this.identifier} MESSAGE ${data}`);
		});

		this.global_local_ctime_start = Date.now();
		this.gameid = 0;

		this.sendFrame = this.sendFrame.bind(this);
		this.nextGame = this.nextGame.bind(this);
	}

	sendFrame() {
		// console.log(`${this.identifier} sendFrame()`);

		// TODO: it's annoying that the load tester need to do so much parsing and serialization, can we do something about it?
		// e.g. parse all frames at bootstrap? so runtime work is only to encode?

		const binary_frame = this.game.frames.slice(
			this.idx,
			this.idx + this.game.frame_size
		);
		/*
        console.log(binary_frame);
        console.log(this.idx);
        console.log(binary_frame[0].toString(2));
        console.log(binary_frame[0] >> 5);
        /**/

		const frame_pojo = BinaryFrame.parse(binary_frame);

		frame_pojo.gameid = this.gameid;
		frame_pojo.ctime = Date.now() - this.global_local_ctime_start;

		this.ws.send(BinaryFrame.encode(frame_pojo));

		this.idx += this.game.frame_size;

		// console.log(this.idx, this.game.frame_size, this.game.frames.length);

		if (this.idx >= this.game.frames.length) {
			// TODO: find a way to kill the test!
			setTimeout(this.nextGame, 5000);
		} else {
			// schedule next frame
			// TODO: Add speed multiplier (or should we not? hmmm)
			const next_frame = this.game.frames.slice(
				this.idx,
				this.idx + this.game.frame_size
			);
			const next_frame_ctime = BinaryFrame.getCTime(next_frame);
			const next_frame_ctime_diff = next_frame_ctime - this.game_start_ctime;
			const next_frame_local_time =
				this.game_start_local + next_frame_ctime_diff;

			setTimeout(this.sendFrame, next_frame_local_time - Date.now());
		}
	}

	nextGame() {
		console.log(`${this.identifier} nextGame()`);

		this.game = this.games.shift();
		this.games.push(this.game);

		++this.gameid;
		this.idx = 0;

		const first_frame = this.game.frames.slice(0, this.game.frame_size);
		this.game_start_ctime = BinaryFrame.getCTime(first_frame);
		this.game_start_local = Date.now();

		try {
			this.sendFrame();
		} catch (err) {
			console.log('==========');
			console.log(err);
			console.log(this.game.filename);
			console.log(this.game.version);
			console.log(this.game.frame_size);
			console.log(first_frame);
			return;
		}
	}
}

async function runWorker() {
	console.log(workerData);

	// load the game files to be reused by all the players
	for (const filename of localGameFiles) {
		// super heavy cost at the start to do everything synchronously... but who cares... -_-
		const buffer = new Uint8Array(
			zlib.unzipSync(fs.readFileSync(new URL(`./${filename}`, import.meta.url)))
		);
		const version = buffer[0] >> 5;
		const frame_size = BinaryFrame.FRAME_SIZE_BY_VERSION[version];

		// console.log(buffer[0].toString(2).padStart(8, '0'));
		// console.log((buffer[0] >> 5));

		localGames.push({
			frames: buffer,
			filename,
			version,
			frame_size,
		});

		console.log(filename, buffer.length, buffer.length / frame_size);
	}

	const { host_num, server_domain } = workerData;

	// add 6 players to make 8 in the room
	const admin_commands = [
		['removePlayer', 0],
		['removePlayer', 0],
		['removePlayer', 0],
		['removePlayer', 0],
		['removePlayer', 0],
		['removePlayer', 0],
		['removePlayer', 0],
		['removePlayer', 0],
		['addPlayer'],
		['addPlayer'],
		['addPlayer'],
		['addPlayer'],
		['addPlayer'],
		['addPlayer'],
		['addPlayer'],
		['addPlayer'],
	];

	// all player connects
	console.log([host_num, server_domain]);

	for (let player_idx = 8; player_idx--; ) {
		const player_id = (host_num - 1) * 8 + player_idx + 1;
		new Player(server_domain, host_num, player_id);

		admin_commands.push(['setPlayer', player_idx, `${player_id}`]);

		await new Promise(resolve => setTimeout(resolve, 16.6666666666 * 4));
	}

	await new Promise(resolve => setTimeout(resolve, 5000));

	const admin_secret = `PLAYER${host_num}`;
	const admin_ws_url = `ws://${server_domain}/ws/room/admin/${admin_secret}`;

	const admin_ws = new WebSocket(admin_ws_url, { perMessageDeflate: false });

	admin_ws.on('open', () => {
		console.log(`Admin WS OPEN`);
		// we blast the room setup like pigs! with no regards for work time
		setInterval(() => {
			const command = admin_commands.shift();
			if (command) {
				admin_ws.send(JSON.stringify(command));
			}
		}, 100);
	});
	admin_ws.on('error', console.error);
	admin_ws.on('message', data => {
		// console.log(`${this.identifier} MESSAGE ${data}`);
	});
}

if (isMainThread) {
	runDriver();
} else {
	runWorker();
}
