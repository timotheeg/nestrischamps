// NTSC NES resolution: 256x224 -> 512x448
const reference_size = [512, 448];
const reference_locations = {
	score:         { crop: [384, 112, 94, 14], pattern: "DDDDDD" },
	level:         { crop: [416, 320, 30, 14], pattern: "TD" },
	lines:         { crop: [304, 32, 46, 14],  pattern: "TDD" },
	field:         { crop: [192, 80, 160, 320] },
	preview:       { crop: [384, 224, 62, 30] },
	color1:        { crop: [76, 212, 10, 10] },
	color2:        { crop: [76, 246, 10, 10] },
	instant_das:   { crop: [80, 64, 30, 14],  pattern: "BD" },
	cur_piece_das: { crop: [112, 96, 30, 14], pattern: "BD" },
	cur_piece:     { crop: [30, 89, 45, 23] },
	T:             { crop: [96, 176, 46, 14], pattern: "BDD", red: true },
	J:             { crop: [96, 208, 46, 14], pattern: "BDD", red: true },
	Z:             { crop: [96, 240, 46, 14], pattern: "BDD", red: true },
	O:             { crop: [96, 273, 46, 14], pattern: "BDD", red: true },
	S:             { crop: [96, 304, 46, 14], pattern: "BDD", red: true },
	L:             { crop: [96, 336, 46, 14], pattern: "BDD", red: true },
	I:             { crop: [96, 368, 46, 14], pattern: "BDD", red: true },
};

const configs = {
	classic: {
		reference: '/ocr/reference_ui_classic.png',
		fields: [
			'score',
			'level',
			'lines',
			'field',
			'preview',
			'color1',
			'color2',
			'T',
			'J',
			'Z',
			'O',
			'S',
			'L',
			'I',
		],
	},
	das_trainer: {
		reference: '/ocr/reference_ui_das_trainer.png',
		palette: 'easiercap',
		fields: [
			'score',
			'level',
			'lines',
			'field',
			'preview',
			'instant_das',
			'cur_piece_das',
			'cur_piece'
		],
	}
};

let do_deinterlace = true;

const
	reference_ui     = document.querySelector('#reference_ui'),
	video_capture    = document.querySelector('#video_capture'),

	wizard           = document.querySelector('#wizard'),
	device_selector  = document.querySelector('#device'),
	color_matching   = document.querySelector('#color_matching'),
	palette_selector = document.querySelector('#palette'),
	rom_selector     = document.querySelector('#rom'),
	go_btn           = document.querySelector('#go'),

	controls         = document.querySelector('#controls'),
	show_parts       = document.querySelector('#show_parts'),

	conn_host        = document.querySelector('#conn_host'),
	conn_port        = document.querySelector('#conn_port'),
	video            = document.querySelector('#device_video'),
	ocr_results      = document.querySelector('#ocr_results'),
	frame_data       = document.querySelector('#frame_data'),
	perf_data        = document.querySelector('#perf_data'),
	capture          = document.querySelector('#capture'),
	adjustments      = document.querySelector('#adjustments')
;

const IN_GAME = {};
const IN_MENU = {};

let ocv;
let templates;
let palettes;
let tetris_ocr;
let config;
let connection;

device_selector.addEventListener('change', evt => {
	config.device_id = device_selector.value;
	playVideoFromConfig();
	checkActivateGoButton();
});

palette_selector.disabled = true;
palette_selector.addEventListener('change', evt => {
	config.palette = palette_selector.value;
	checkActivateGoButton();
});

rom_selector.addEventListener('change', evt => {
	if (rom_selector.value === 'classic') {
		color_matching.style.display = 'block';
		palette_selector.value = '';
		palette_selector.disabled = false;
	}
	else {
		color_matching.style.display = 'none';
		palette_selector.disabled = true;
		palette_selector.value = Object.keys(palettes)[0];
	}

	config.palette = palette_selector.value;

	checkActivateGoButton();
});

function checkActivateGoButton() {
	// no need to check palette, if rom_selector has a value, then palette automatically has a valid value too
	const all_ready = device_selector.value && rom_selector.value;

	go_btn.disabled = !all_ready;
}

function connect() {
	if (connection) {
		connection.close();
	}

	connection = new Connection();
}

conn_host.addEventListener('change', connect);
conn_port.addEventListener('change', connect);

clear_config.addEventListener('click', evt => {
	localStorage.clear();
	location.reload();
});

start_timer.addEventListener('click', evt => {
	connection.send(['startTimer'])
})

go_btn.disabled = true;
go_btn.addEventListener('click', async (evt) => {
	if (device_selector.value == 0) return;

	device_selector.disabled = true;
	rom_selector.disabled = true;
	go_btn.disabled = true;

	// set up config per rom selection
	const rom_config = configs[rom_selector.value];

	await loadImage(reference_ui, rom_config.reference);

	const bitmap = await createImageBitmap(video,
		0, 0, video.videoWidth, video.videoHeight,
		do_deinterlace
			? {
				resizeWidth: video.videoWidth,
				resizeHeight: video.videoHeight >> 1,
				resizeQuality: 'pixelated',
			}
			: {}
	);

	updateCanvasSizeIfNeeded(
		video_capture,
		video.videoWidth,
		video.videoHeight >> (do_deinterlace ? 1 : 0)
	);

	video_capture.getContext('2d').drawImage(bitmap, 0, 0);

	await new Promise(resolve => {
		setTimeout(resolve, 0); // wait one tick for everything to be drawn nicely... just in case
	});

	let [ox, oy, ow, oh] = getCaptureCoordinates('reference_ui', 'video_capture');

	if (ow <= 0 || oh <= 0) {
		console.log('Unable to match template');
		ox = 0;
		oy = 0;
		ow = video.videoWidth;
		oh = video.videoHeight >> (do_deinterlace ? 1 : 0);
	}
	else {
		console.log('Found offsets!');
	}

	console.log('Using offsets: ', ox, oy, ow, oh);

	const xscale = ow / reference_size[0];
	const yscale = oh / reference_size[1];

	console.log('scale factors', xscale, yscale);

	rom_config.fields.forEach(name => {
		config.tasks[name] = JSON.parse(JSON.stringify(reference_locations[name]));

		const crop = config.tasks[name].crop;

		console.log(name, 'crop before', crop);

		crop[0] = Math.round(ox + crop[0] * xscale);
		crop[1] = Math.round(oy + crop[1] * yscale);
		crop[2] = Math.round(crop[2] * xscale);
		crop[3] = Math.round(crop[3] * yscale);

		console.log(name, 'crop after', crop);
	});

	saveConfig(config);
	trackAndSendFrames();

	wizard.style.display = 'none';
	controls.style.display = 'block';
});

show_parts.addEventListener('change', evt => {
	const display = show_parts.checked ? 'block' : 'none';

	adjustments.style.display = display;
	config.di_canvas.style.display = display;
});

function loadImage(img, src) {
	return new Promise(resolve => {
		img.onload = resolve;
		img.src = src;
	});
}

function updatePaletteList() {
	palette_selector.innerHTML = '';

	[
		{
			label: 'Read from frame',
			value: ''
		},
		...Object.keys(palettes).map(value => ({label: `${value} palette`, value}))
	]
	.forEach(option => {
		const palette_option = document.createElement('option');
		palette_option.text = option.label;
		palette_option.value = option.value;

		if (config && config.palette === option.value) {
			palette_option.selected = true;
		}

		palette_selector.appendChild(palette_option)
	});
}

// Updates the select element with the provided set of cameras
function updateDeviceList(devices) {
	device_selector.innerHTML = '';

	[
		{
			label: "-",
			deviceId: ""
		},
		{
			label: "Window Capture",
			deviceId: "window"
		},
		...devices
	]
	.forEach(camera => {
		const camera_option = document.createElement('option');
		camera_option.text = camera.label;
		camera_option.value = camera.deviceId;

		if (config && config.device_id === camera.deviceId) {
			camera_option.selected = true;
		}

		device_selector.appendChild(camera_option)
	});
}

async function getConnectedDevices(type) {
	// prompt for permission if needed
	const stream = await navigator.mediaDevices.getUserMedia({ video: true });
	stream.getTracks()[0].stop();

	return (await navigator.mediaDevices.enumerateDevices())
		.filter(device => device.kind === type && device.deviceId)
}

async function resetDevices() {
	const devicesList = await getConnectedDevices('videoinput');
	updateDeviceList(devicesList);
}

navigator.mediaDevices.addEventListener('devicechange', resetDevices);


async function playVideoFromDevice(device_id) {
	try {
		const constraints = {
			audio: false,
			video: {
				width: { ideal: 640 },
				height: { ideal: 480 },
				frameRate: { ideal: 60 }
			}
		};

		if (device_id) {
			constraints.video.deviceId = { exact: device_id };
		}

		const stream = await navigator.mediaDevices.getUserMedia(constraints);

		// we only prompt for permission with the first call
		if (device_id === undefined) return;

		// when an actual device id is supplied, we start everything
		video.srcObject = stream;
		video.play();
	}
	catch(error) {
		console.error('Error opening video camera.', error);
		video.pause();
	}
}

async function playVideoFromScreenCap() {
	try {
		const constraints = {
			audio: false,
			video: {
				cursor: 'never',
				frameRate: { ideal: 60 }
			}
		};

		const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

		// when an actual device id is supplied, we start everything
		video.srcObject = stream;
		video.play();
	}
	catch(error) {
		console.error('Error capturing window.', error);
		video.pause();
	}
}

async function playVideoFromConfig() {
	if (!config.device_id) {
		return;
	}
	else if (config.device_id === 'window') {
		do_deinterlace = false;
		await playVideoFromScreenCap();
	}
	else {
		do_deinterlace = false;
		await playVideoFromDevice(config.device_id);
	}
}

let capture_process, blob;
let frame_count = 0;
let frame_ms = 1000/30;
let start_time_ms;
let last_frame_time;

async function startCapture(stream) {
	capture_process = clearTimeout(capture_process);

	if (!stream) {
		stream = video.srcObject;

		if (!stream) {
			return;
		}
	}

	stream.addEventListener('inactive', console.log('stream is inactive'));
	stream.addEventListener('close', console.log('stream is closed'));

	const settings = stream.getVideoTracks()[0].getSettings();

	console.log(`Video settings: ${settings.width}x${settings.height}@${settings.frameRate.toFixed(1)}fps`);

	if (stream.asset) {
		const response = await fetch(stream.asset);
		blob = await response.blob();
	}

	if (show_parts.checked) {
		adjustments.style.display = 'block';
		ocr_results.style.display = 'flex';
	}

	frame_ms = 1000 / settings.frameRate;
	start_time_ms = Date.now();
	last_frame_time = start_time_ms;
	captureFrame();
}

async function captureFrame() {
	++frame_count;
	const now = Date.now();

	// perf_data.textContent = now - last_frame_time;
	last_frame_time = now;

	try {
		let bitmap;

		// let's assume that pixelated resize of height divided 2 is the same as dropping every other row
		// which is equivalent to the deinterlacing we want to do

		performance.mark('capture_start');
		if (blob) {
			// images are known to be 720x480
			bitmap = await createImageBitmap(blob,
				0, 0, 720, 480,
				{
					resizeWidth: 720,
					resizeHeight: 480 >> 1,
					resizeQuality: 'pixelated',
				}
			);
		}
		else {
			// we do cheap deinterlacing with pixelated resize...
			bitmap = await createImageBitmap(video,
				0, 0, video.videoWidth, video.videoHeight,
				do_deinterlace
					? {
						resizeWidth: video.videoWidth,
						resizeHeight: video.videoHeight >> 1,
						resizeQuality: 'pixelated',
					}
					: {}
			);
		}
		performance.mark('capture_end');

		tetris_ocr.processFrame(bitmap);
	}
	catch(err) {
		console.error(err);
	}

	// schedule next async run, device wil hold till next frame 👍
	// might need to do a animationFrame or 60fps interval 🤔
	capture_process = setTimeout(captureFrame, 0);
}

function showTemplates(templates) {
	const tpl = document.querySelector('#templates');

	for (let template of templates) {
		const canvas = document.createElement('canvas');
		canvas.width = 14;
		canvas.height = 14;
		const ctx = canvas.getContext('2d');
		const img = new ImageData(14, 14);
		for (let p_idx=template.length; p_idx--; ) {
			const luma = template[p_idx];
			const offset_idx = p_idx << 2;
			img.data[offset_idx] = luma;
			img.data[offset_idx + 1] = luma;
			img.data[offset_idx + 2] = luma;
			img.data[offset_idx + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
		tpl.appendChild(canvas);
	}
}

function updateCanvasSizeIfNeeded(canvas, w, h) {
	if (canvas.width != w || canvas.height != h) {
		canvas.width = w;
		canvas.height = h;
	}
}

function resetConfig(config, task_name, task_crop) {
	if (task_name) {
		config.tasks[task_name].crop = task_crop;

		// update display canvas with new data
		const canvas = config.tasks[task_name].crop_canvas_ctx.canvas;
		updateCanvasSizeIfNeeded(
			canvas,
			task_crop[2] * 2,
			task_crop[3] * 2
		);
		config.tasks[task_name].crop_canvas_ctx = canvas.getContext('2d');
	}

	// set the new config
	tetris_ocr.setConfig(config);

	updateCanvasSizeIfNeeded(
		config.di_canvas,
		config.capture_area.w,
		config.capture_area.h
	);

	saveConfig(config);
}

function showColorControls(palettes, config) {
	const has_valid_palette = !!(config.palette && palettes[config.palette]);
	const display = has_valid_palette ? 'none' : 'block';

	const color_fieldset = document.querySelector(`fieldset.color1`);

	if (color_fieldset) {
		document.querySelector(`fieldset.color1`).style.display = display;
		document.querySelector(`fieldset.color2`).style.display = display;
	}
}

function showConfigControls(templates, palettes, config) {
	for (const [name, task] of Object.entries(config.tasks)) {
		const fieldset = document.createElement('fieldset');
		fieldset.classList.add(name);

		const legend = document.createElement('legend');
		legend.textContent = name;
		fieldset.appendChild(legend);

		addCropControls(fieldset, config, name, resetConfig);

		const canvas_holder = document.createElement('div');
		canvas_holder.classList.add('results')
		fieldset.appendChild(canvas_holder);

		adjustments.appendChild(fieldset);
	}

	showColorControls(palettes, config);
}

function addCropControls(parent, config, name, onChangeCallback) {
	const holder = document.createElement('div');
	const inputs = [];

	function onChange() {
		onChangeCallback(config, name, inputs.map(input => parseInt(input.value, 10)));
	}

	['x', 'y', 'width', 'height'].forEach((label, idx) => {
		const span = document.createElement('span');
		span.textContent = ` ${label}: `;

		const input = document.createElement('input');
		input.classList.add('coordinate_input');
		input.type = 'number';
		input.size = 3;
		input.value = config.tasks[name].crop[idx];
		input.addEventListener('change', onChange);

		inputs.push(input);

		holder.appendChild(span);
		holder.appendChild(input);
	});

	parent.appendChild(holder);
}

async function showParts(data) {
	const half_di_height = Math.floor(config.deinterlaced_img.height);

	if (!config.di_canvas) {
		const di_canvas = document.createElement('canvas');
		di_canvas.width = config.deinterlaced_img.width;
		di_canvas.height = half_di_height;
		capture.appendChild(di_canvas);

		config.di_canvas = di_canvas;
	}

	const di_ctx = config.di_canvas.getContext('2d');

	di_ctx.putImageData(config.deinterlaced_img,
		0, 0,
		0, 0,
		config.deinterlaced_img.width, half_di_height
	);

	di_ctx.fillStyle = '#FFA50080';

	const x_offset = config.capture_area.x;
	const y_offset = config.capture_area.y;

	for (const name of Object.keys(data)) {
		const task = config.tasks[name];

		if (!task) continue;

		const holder = document.querySelector(`fieldset.${name} div.results`);
		let separator;

		if (!task.crop_canvas_ctx) {
			// create canvas at 2x resolution to make it easier to see the areas
			const crop_canvas = document.createElement('canvas');
			crop_canvas.width = task.crop_img.width * 2;
			crop_canvas.height = task.crop_img.height * 2;
			holder.appendChild(crop_canvas);

			separator = document.createElement('span');
			separator.textContent = ' ⟹ ';
			holder.appendChild(separator);

			const scale_canvas = document.createElement('canvas');
			scale_canvas.width = task.scale_img.width * 2;
			scale_canvas.height = task.scale_img.height * 2;
			holder.appendChild(scale_canvas);

			separator = document.createElement('span');
			separator.textContent = ' ⟹ ';
			holder.appendChild(separator);

			task.crop_canvas_ctx = crop_canvas.getContext('2d');
			task.scale_canvas_ctx = scale_canvas.getContext('2d');

			task.crop_canvas_ctx.imageSmoothingEnabled = false;
			task.scale_canvas_ctx.imageSmoothingEnabled = false;

			if (name.startsWith('color')) {
				const color_result = document.createElement('div');
				color_result.classList.add('col_res');
				color_result.style.display = 'inline-block';
				color_result.style.width = '25px';
				color_result.style.height = '25px';

				holder.appendChild(color_result);
			}

			const text_result = document.createElement('pre');
			holder.appendChild(text_result);
		}

		const cropped = await createImageBitmap(task.crop_img, 0, 0, task.crop_img.width, task.crop_img.height, {
			resizeWidth: task.crop_img.width * 2,
			resizeHeight: task.crop_img.height * 2,
			resizeQuality: 'pixelated'
		});

		const scaled = await createImageBitmap(task.scale_img, 0, 0, task.scale_img.width, task.scale_img.height, {
			resizeWidth: task.scale_img.width * 2,
			resizeHeight: task.scale_img.height * 2,
			resizeQuality: 'pixelated'
		});

		// draw task captured areas
		task.crop_canvas_ctx.drawImage(cropped, 0, 0);
		task.scale_canvas_ctx.drawImage(scaled, 0, 0);

		// highlight captured areas in main deinterlaced image
		const [x, y, w, h] = task.crop;
		di_ctx.fillRect(x - x_offset, y - y_offset, w, h);

		// show text result
		if (name.startsWith('color')) {
			const color = `rgb(${data[name][0]},${data[name][1]},${data[name][2]})`;

			holder.querySelector(`.col_res`).style.backgroundColor = color;
			holder.querySelector(`pre`).textContent = color;
		}
		else if (name != 'field') {
			holder.querySelector(`pre`).innerHTML = data[name] === null ? '&nbsp;' : data[name];
		}
		else {
			const rows = [];
			for (let ridx=0; ridx<20; ridx++) {
				rows.push(data[name].slice(ridx * 10, ridx * 10 + 10));
			}
			holder.querySelector(`pre`).textContent = rows.join('\n');
		}
	}
}

function saveConfig(config) {
	// need to drop non-serializable fields
	const config_copy = {
		deinterlace: config.deinterlace,
		device_id: config.device_id,
		palette: config.palette,
		tasks: {}
	};

	for (const [name, task] of Object.entries(config.tasks)) {
		config_copy.tasks[name] = {
			crop: task.crop,
			pattern: task.pattern,
			red: task.red,
		};
	}

	localStorage.setItem('config', JSON.stringify(config_copy));
}

function hasConfig() {
	return !!localStorage.getItem('config');
}

function loadConfig() {
	const config = localStorage.getItem('config');

	if (config) {
		return JSON.parse(config);
	}
}

function showFrameData(data) {
	// TODO: fix markup on config change, rather than destroy-rebuild at every frame
	frame_data.innerHTML = '';

	for (const [name, value] of Object.entries(data)) {
		const dt = document.createElement('dt');
		const dd = document.createElement('dd');

		dt.textContent = name;
		if (name === 'field') {
			dd.textContent = `${data.field.slice(0, 30)}...`;
		}
		else {
			dd.textContent = value;
		}

		frame_data.appendChild(dt);
		frame_data.appendChild(dd);
	}
}

function showPerfData(perf) {
	// TODO: fix markup on config change, rather than destroy-rebuild at every frame
	perf_data.innerHTML = '';

	for (const [name, value] of Object.entries(perf)) {
		const dt = document.createElement('dt');
		const dd = document.createElement('dd');

		dt.textContent = name;
		dd.textContent = value;

		perf_data.appendChild(dt);
		perf_data.appendChild(dd);
	}
}

function trackAndSendFrames() {
	if (show_parts.checked) {
		showConfigControls(templates, palettes, config);
	}

	tetris_ocr = new TetrisOCR(templates, palettes, config);

	let start_time = Date.now();
	let game_state = IN_GAME;
	let gameid = 1;

	// TODO: better event system and name for frame data events
	tetris_ocr.onMessage = async function(data) {
		// replicate NESTrisOCR gameid logic
		if (game_state === IN_GAME) {
			if (data.score === null && data.lines === null) {
				game_state = IN_MENU;
			}
		}
		else {
			if (data.score != null && data.lines != null) {
				game_state = IN_GAME;

				if (data.score === 0 && (data.lines === 0 || data.lines === 25)) {
					gameid++;
				}
			}
		}

		data.gameid = gameid;
		data.ctime = Date.now() - start_time;

		if (show_parts.checked) {
			performance.mark('show_parts_start');
			await showParts(data);
			performance.mark('show_parts_end');
			performance.measure('show_parts', 'show_parts_start', 'show_parts_end');
		}

		const perf = {};

		performance.measure('capture', 'capture_start', 'capture_end');

		performance.mark('show_frame_data_start');
		showFrameData(data);
		performance.mark('show_frame_data_end');
		performance.measure('show_frame_data', 'show_frame_data_start', 'show_frame_data_end');

		performance.mark('process_over');
		performance.measure('total', 'capture_start', 'process_over');

		const measures = performance.getEntriesByType("measure").forEach(m => {
			perf[m.name] =  m.duration.toFixed(3);
		});

		showPerfData(perf);
		performance.clearMarks();
		performance.clearMeasures();

		delete data.color1;
		delete data.color2;

		connection.send(BinaryFrame.encode(data));
	}


	/*
	const fake_stream = {
		asset: './full3.png',
		addEventListener: function() {},
		getVideoTracks() {
			return [{
				getSettings() {
					return {
						width: 720,
						height: 480,
						frameRate: 12
					}
				}
			}]
		}
	};

	startCapture(fake_stream);
	return;
	/**/

	startCapture();
}


(async function init() {

	// load external assets - could parrallelize
	templates = await loadDigitTemplates();
	palettes = await loadPalettes();

	connect();

	await updatePaletteList();

	if (hasConfig()) {
		config = loadConfig();
		await resetDevices();
		controls.style.display = 'block';
		await playVideoFromConfig();
		trackAndSendFrames();
	}
	else {
		// Dynamically load openCV we need to load opencv now
		const script = document.createElement('script');

		await new Promise(resolve => {
			script.onload = resolve;
			script.src = '/ocr/opencv.js';
			document.head.appendChild(script);
		});

		await resetDevices();

		ocv = await cv;

		// create default dummy waiting to be populated by user selection
		config = { tasks: {} };
		wizard.style.display = 'block';
	}
})();
