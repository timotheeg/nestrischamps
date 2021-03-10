let timeline_idx = 0;

function splitField(field) {
	let rows = [], idx=0;

	do {
		row = field.substr(idx, 10);
		rows.push(row);
		idx += 10
	}
	while(idx<200);

	return rows.join('\n');
}

function oneFrame(debug=false) {
	const
		frame1_copy = {...frames[timeline_idx]},
		field1 = frame1_copy.field,

		frame2_copy = {...frames[timeline_idx+1]},
		field2 = frame2_copy.field;

	delete frame1_copy.field;
	delete frame2_copy.field;

	frame1_txt = ''
		+ timeline_idx
		+ ' '
		+ field1.replace(/0+/g, '').length
		+ '\n'
		+ JSON.stringify(frame1_copy)
		+ ' '
		+ splitField(field1);

	frame2_txt = ''
		+ (timeline_idx + 1)
		+ ' '
		+ field2.replace(/0+/g, '').length
		+ '\n'
		+ JSON.stringify(frame2_copy)
		+ ' '
		+ splitField(field2);

	document.querySelector('#cur_frame').value = frame1_txt;
	document.querySelector('#next_frame').value = frame2_txt;

	// update frame to be new format compatible
	frame = frames[timeline_idx++]

	frame.field = frame.field.split('').map(v => parseInt(v, 10))
	frame.lines = parseInt(frame.lines, 10);
	frame.level = parseInt(frame.level, 10);
	frame.score = parseInt(frame.score, 10);
	frame.T = parseInt(frame.T, 10);
	frame.J = parseInt(frame.J, 10);
	frame.Z = parseInt(frame.Z, 10);
	frame.O = parseInt(frame.O, 10);
	frame.S = parseInt(frame.S, 10);
	frame.L = parseInt(frame.L, 10);
	frame.I = parseInt(frame.I, 10);

	onFrame(frame, debug);
}

function createElementFromHTML(htmlString) {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();

  // Change this to div.childNodes to support multiple top-level nodes
  return div.firstChild;
}

(function setupDebugUI() {
	// 1. load the debug css to HEAD
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.type = 'text/css';
	link.href = '/views/debug.css';
	document.getElementsByTagName('HEAD')[0].appendChild(link);

	// 2. prepend the debug elements to BODY
	const body = document.getElementsByTagName('BODY')[0];

	[
		'<textarea id="cur_frame"></textarea>',
		'<textarea id="next_frame"></textarea>',
		'<button id="goto_next_frame">Next Frame</button>',
		'<button id="goto_next_frame_debug">Next Frame Debug</button>',
		'<button id="play">Play</button>',
		'<button id="stop">Stop</button>',
		'<div id="skip"><input class="to"></body><button class="btn">Skip to</button></div>',
	]
		.reverse()
		.forEach(element_string => {
			body.prepend(createElementFromHTML(element_string));
		});

})();

document.querySelector('#goto_next_frame').addEventListener('click', () => {
	oneFrame();
});

document.querySelector('#goto_next_frame_debug').addEventListener('click', () => {
	oneFrame(true);
});

let play_ID

function play() {
	function playFrame() {
		oneFrame()
		play_ID = window.requestAnimationFrame(playFrame);
	}

	playFrame();
}

function stop() {
	window.cancelAnimationFrame(play_ID);
}

document.querySelector('#play').addEventListener('click', play);
document.querySelector('#stop').addEventListener('click', stop);

document.querySelector('#skip .btn').addEventListener('click', () => {
	const
		input = document.querySelector('#skip .to').value,
		to = parseInt(input, 10);

	if (isNaN(to)) {
		console.error('invalid input', input);
		return;
	}

	while (timeline_idx < to) {
		oneFrame();
	}
});
