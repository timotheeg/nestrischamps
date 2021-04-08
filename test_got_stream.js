const got = require('got');
const BinaryFrame = require('./public/js/BinaryFrame');

const ins = got.stream('https://nestrischamps.s3-us-west-1.amazonaws.com/games/1/01F2K/YYD4ZVCW0H39STT588SNP.ngf');


const frames = [];

let start_time;
let start_ctime;


ins.on('readable', () => {
	console.log('readable');
	do {
		const buf = ins.read(71);

		if (!buf) {
			return; // done!!
		}

		if (buf.length < 71) {
			ins.unshift(buf);
			ins.read(0);
			return;
		}

		if (!start_time) {
			const data = BinaryFrame.parse(buf);

			start_time = Date.now();
			start_ctime = data.ctime;

			console.log(data); // send now
		}
		else if (frames.length == 0) {
			const tdiff = BinaryFrame.getCTime(buf) - start_ctime;
			const frame_tick = start_time + tdiff;
			const now = Date.now();

			if (now > frame_tick) {
				console.log('too slow!')
				console.log(BinaryFrame.parse(buf));
			}
			else {
				frames.push(buf);
				setTimeout(sendFrame, frame_tick - now);
			}
		}
		else {
			frames.push(buf);

		}
	}
	while(true);
});

function sendFrame() {
	if (frames.length <= 0) return;

	console.log(BinaryFrame.parse(frames.shift()));

	if (frames.length) {
		const tdiff = BinaryFrame.getCTime(frames[0]) - start_ctime;
		const frame_tick = start_time + tdiff;
		const now = Date.now();

		if (now > frame_tick) {
			console.log('too slow 2!')
			console.log(BinaryFrame.parse(frames[0]));
		}
		else {
			setTimeout(sendFrame, frame_tick - now);
		}
	}
}