import BinaryFrame from '../public/js/BinaryFrame.js';
import { peek } from '../public/views/utils.js';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import zlib from 'zlib';

export async function getGameFrames(gameid) {
	const game_url = `https://nestrischamps.io/api/games/${gameid}`;
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

	const then = Date.now();
	let idx = 0;
	const frames = [];

	console.log(`Populating game`);
	while (idx < buffer.length) {
		const binary_frame = buffer.slice(idx, idx + frame_size);
		const frame_data = BinaryFrame.parse(binary_frame);
		frames.push(frame_data);
		idx += frame_size;
	}

	console.log(
		`Done parsing game ${gameid} with ${frames.length} frames in ${
			Date.now() - then
		}ms.`
	);

	return {
		gamedata,
		frames,
	};
}

(async function () {
	const gameids = process.argv.slice(2);
	const games = await Promise.all(gameids.map(gameid => getGameFrames(gameid)));
	const frame_file = peek(games)
		.gamedata.frame_url.replace(/^https:\/\/[^/]+\//, '')
		.replace(/ngf$/, 'concat.ngf');

	const frame_stream = zlib.createGzip();

	const upload = new Upload({
		client: new S3Client({ region: process.env.GAME_FRAMES_REGION }),
		leavePartsOnError: false,
		params: {
			Bucket: process.env.GAME_FRAMES_BUCKET,
			Key: frame_file,
			Body: frame_stream,
			ACL: 'public-read',
			ContentType: 'application/nestrischamps-game-frames',
			ContentEncoding: 'gzip',
			ContentDisposition: 'attachment',
			CacheControl: 'max-age=315360000',
		},
	});

	games
		.map(game => game.frames)
		.flat()
		.forEach(frame => {
			frame.gameid = 1;
			frame_stream.write(BinaryFrame.encode(frame));
		});

	frame_stream.end();

	await upload.done();

	console.log(`written to ${frame_file}`);
})();
