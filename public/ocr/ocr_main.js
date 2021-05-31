// NTSC NES resolution: 256x224 -> 512x448
const LEVEL_COLORS = [
	[ '#4A32FF', '#4AAFFE' ],
	[ '#009600', '#6ADC00' ],
	[ '#B000D4', '#FF56FF' ],
	[ '#4A32FF', '#00E900' ],
	[ '#C8007F', '#00E678' ],
	[ '#00E678', '#968DFF' ],
	[ '#C41E0E', '#666666' ],
	[ '#8200FF', '#780041' ],
	[ '#4A32FF', '#C41E0E' ],
	[ '#C41E0E', '#F69B00' ],
];

const reference_size = [512, 448];
const reference_locations = {
	score:         { crop: [384, 112, 94, 14], pattern: "ADDDDD" },
	level:         { crop: [416, 320, 30, 14], pattern: "QA" },
	lines:         { crop: [304, 32, 46, 14],  pattern: "QDD" },
	field:         { crop: [192, 80, 158, 318] },
	preview:       { crop: [384, 224, 62, 30] },
	color1:        { crop: [76, 170, 10, 10] },
	color2:        { crop: [76, 212, 10, 10] },
	color3:        { crop: [76, 246, 10, 10] },
	instant_das:   { crop: [80, 64, 30, 14],  pattern: "BD" },
	cur_piece_das: { crop: [112, 96, 30, 14], pattern: "BD" },
	cur_piece:     { crop: [30, 89, 45, 23] },
	T:             { crop: [96, 176, 46, 14], pattern: "TDD", red: true },
	J:             { crop: [96, 208, 46, 14], pattern: "TDD", red: true },
	Z:             { crop: [96, 240, 46, 14], pattern: "TDD", red: true },
	O:             { crop: [96, 272, 46, 14], pattern: "TDD", red: true },
	S:             { crop: [96, 304, 46, 14], pattern: "TDD", red: true },
	L:             { crop: [96, 336, 46, 14], pattern: "TDD", red: true },
	I:             { crop: [96, 368, 46, 14], pattern: "TDD", red: true },
};

const configs = {
	classic: {
		game_type: BinaryFrame.GAME_TYPE.CLASSIC,
		reference: '/ocr/reference_ui_classic.png',
		fields: [
			'score',
			'level',
			'lines',
			'field',
			'preview',
			'color1',
			'color2',
			'color3',
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
		game_type: BinaryFrame.GAME_TYPE.DAS_TRAINER,
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

const default_frame_rate = 60;

let do_half_height = true;

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
	capture_rate     = document.querySelector('#capture_rate'),
	show_parts       = document.querySelector('#show_parts'),
	timer_control    = document.querySelector('#timer_control'),
	start_timer      = document.querySelector('#start_timer'),

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
let ocr_corrector;
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

capture_rate.addEventListener('change', updateFrameRate);

function checkActivateGoButton() {
	// no need to check palette, if rom_selector has a value, then palette automatically has a valid value too
	const all_ready = device_selector.value && rom_selector.value;

	go_btn.disabled = !all_ready;
}

const notice = document.querySelector('div.notice');

function resetNotice() {
	notice.classList.remove('error');
	notice.classList.remove('warning');
	notice.textContent = '';
	notice.style.display = 'none';
}

let peer = null;

function connect() {
	if (connection) {
		connection.close();
	}

	connection = new Connection();

	connection.onMessage = function(frame) {
		try{
			let [method, ...args] = frame;

			switch(method) {
				case 'message': {
					speak(args[0]);
				}
			}
		}
		catch(e) {
			console.error(e);
		}
	}

	connection.onKicked = function(reason) {
		resetNotice();
		notice.classList.add('error');
		notice.textContent = `WARNING! The connection has been kicked because [${reason}]. The page will NOT attempt to reconnect.`;
		notice.style.display = 'block';
	}

	connection.onBreak = function() {
		resetNotice();
		notice.classList.add('warning');
		notice.textContent = `WARNING! The page is disconnected. It will try to reconnect automatically.`;
		notice.style.display = 'block';
	}

	connection.onResume = resetNotice;

	connection.onInit = () => {
		if (peer) {
			peer.removeAllListeners();
			peer.destroy();
			peer = null;
		}

		peer = new Peer(connection.id);
	}
}

conn_host.addEventListener('change', connect);
conn_port.addEventListener('change', connect);

clear_config.addEventListener('click', evt => {
	localStorage.clear();
	location.reload();
});

start_timer.addEventListener('click', evt => {
	// minutes are valid per markup restrictions
	const minutes = parseInt(document.querySelector('#minutes').value, 10);

	connection.send(['startTimer', minutes * 60]);
});

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
		0, 0,
		video.videoWidth, video.videoHeight
	);

	updateCanvasSizeIfNeeded(
		video_capture,
		video.videoWidth,
		video.videoHeight
	);

	video_capture.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0);

	await new Promise(resolve => {
		setTimeout(resolve, 0); // wait one tick for everything to be drawn nicely... just in case
	});

	let [ox, oy, ow, oh] = getCaptureCoordinates('reference_ui', 'video_capture');

	if (ow <= 0 || oh <= 0) {
		console.log('Unable to match template');
		ox = 0;
		oy = 0;
		ow = video.videoWidth;
		oh = video.videoHeight;
	}
	else {
		console.log('Found offsets!');
	}

	if (do_half_height) {
		oy /= 2;
		oh /= 2;
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

function onShowPartsChanged() {
	const display = show_parts.checked ? 'block' : 'none';

	adjustments.style.display = display;
	config.source_canvas.style.display = display;

	if (show_parts.checked) {
		resetShowPartsTimer();
	}
}

show_parts.addEventListener('change', onShowPartsChanged);

let hide_show_parts_timer;

function hideParts() {
	show_parts.checked = false;
	onShowPartsChanged();
}

function resetShowPartsTimer() {
	clearTimeout(hide_show_parts_timer);

	hide_show_parts_timer = setTimeout(hideParts, 45000); // parts stop showing after 45s of static config
}

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
	try {
		// prompt for permission if needed
		// on windows, this requests the first available capture device and it may fail
		// BUT if permission has been granted, then listing the devices below might still work
		// SO, we wrap the device call in a try..catch, and ignore errors
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		stream.getTracks()[0].stop();
	}
	catch(err) {
		// We log a warning but we do nothing
		console.log(`Warning: could not open default capture device: $(err.message)`);
	}

	return (await navigator.mediaDevices.enumerateDevices())
		.filter(device => device.kind === type && device.deviceId)
}

async function resetDevices() {
	const devicesList = await getConnectedDevices('videoinput');
	updateDeviceList(devicesList);
}

navigator.mediaDevices.addEventListener('devicechange', resetDevices);

async function playVideoFromDevice(device_id, fps) {
	try {
		const constraints = {
			audio: false,
			video: {
				width: { ideal: 640 },
				height: { ideal: 480 },
				frameRate: { ideal: fps } // Should we always try to get the highest the card can support?
			}
		};

		// whhhyyyyyy???
		if (navigator.userAgent.indexOf("Firefox/") > -1) {
			constraints.video.width.ideal = 1280;
			delete constraints.video.height;
		}

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

async function playVideoFromScreenCap(fps) {
	try {
		const constraints = {
			audio: false,
			video: {
				cursor: 'never',
				frameRate: { ideal: fps }
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

	if (config.device_id === 'window') {
		do_half_height = false;
		await playVideoFromScreenCap(config.frame_rate);
	}
	else {
		do_half_height = true && !QueryString.disable_half_height;
		await playVideoFromDevice(config.device_id, config.frame_rate);
	}

	capture_rate.querySelectorAll('.device_only').forEach(elmt => elmt.hidden = config.device_id === 'window');
}

let capture_process, blob;
let frame_count = 0;

async function updateFrameRate() {
	try {
		video.srcObject.getVideoTracks()[0].stop();
	}
	catch(err) {}

	stopCapture();

	config.frame_rate = parseInt(capture_rate.value, 10);
	saveConfig(config);

	await playVideoFromConfig();

	startCapture();
}

function stopCapture() {
	clearInterval(capture_process);
}

async function startCapture(stream) {
	stopCapture();

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

	const frame_ms = 1000 / settings.frameRate;

	console.log(`Setting capture interval for ${settings.frameRate}fps (i.e. ${frame_ms}ms per frame)`)
	capture_process = setInterval(captureFrame, frame_ms);
}

async function captureFrame() {
	++frame_count;

	try {
		let bitmap;
		let force_half_height = false;

		// let's assume that pixelated resize of height divided 2 is the same as dropping every other row
		// which is equivalent to deinterlacing *cough*

		performance.mark('capture_start');
		if (blob) {
			force_half_height = true;
			// images are known to be 720x480
			bitmap = await createImageBitmap(blob,
				0, 0, 720, 480
			);
		}
		else {
			// we do cheap deinterlacing with pixelated resize...
			bitmap = await createImageBitmap(video,
				0, 0, video.videoWidth, video.videoHeight,
			);
		}
		performance.mark('capture_end');

		tetris_ocr.processFrame(bitmap, do_half_height || force_half_height);
	}
	catch(err) {
		console.error(err);
	}
}

function showTemplates(templates) {
	const tpl = document.querySelector('#templates');

	for (let template of templates) {
		const canvas = document.createElement('canvas');
		canvas.width = 14;
		canvas.height = 14;
		const ctx = canvas.getContext('2d', { alpha: false });
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
		const scale_factor = task_name.startsWith('color') ? 4 : 2;

		updateCanvasSizeIfNeeded(
			canvas,
			task_crop[2] * scale_factor,
			task_crop[3] * scale_factor
		);
		config.tasks[task_name].crop_canvas_ctx = canvas.getContext('2d', { alpha: false });
		config.tasks[task_name].crop_canvas_ctx.imageSmoothingEnabled = false;
	}

	// set the new config
	tetris_ocr.setConfig(config);

	updateCanvasSizeIfNeeded(
		config.source_canvas,
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
		[1, 2, 3].forEach(num => {
			const col_elmt = document.querySelector(`fieldset.color${num}`);

			if (col_elmt) {
				col_elmt.style.display = display;
			}
		});
	}
}

function showConfigControls(templates, palettes, config) {
	// use static display order
	for (const name of Object.keys(reference_locations)) {
		const task = config.tasks[name];

		if (!task) continue;

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
	const source_height = Math.floor(config.source_img.height);

	if (!config.source_canvas) {
		const source_canvas = document.createElement('canvas');
		source_canvas.width = config.source_img.width;
		source_canvas.height = source_height;
		capture.appendChild(source_canvas);

		config.source_canvas = source_canvas;
	}

	const di_ctx = config.source_canvas.getContext('2d', { alpha: false });

	di_ctx.putImageData(config.source_img,
		0, 0,
		0, 0,
		config.source_img.width, source_height
	);

	di_ctx.fillStyle = '#FFA50080';

	const x_offset = config.capture_area.x;
	const y_offset = config.capture_area.y;

	for (const name of Object.keys(data)) {
		const task = config.tasks[name];
		const scale_factor = name.startsWith('color') ? 4 : 2;

		if (!task) continue;

		const holder = document.querySelector(`fieldset.${name} div.results`);
		let separator;

		if (!task.crop_canvas_ctx) {
			// create canvas at 2x resolution to make it easier to see the areas
			const crop_canvas = document.createElement('canvas');
			crop_canvas.width = task.crop_img.width * scale_factor;
			crop_canvas.height = task.crop_img.height * scale_factor;
			holder.appendChild(crop_canvas);

			separator = document.createElement('span');
			separator.textContent = ' ⟹ ';
			holder.appendChild(separator);

			const scale_canvas = document.createElement('canvas');
			scale_canvas.width = task.scale_img.width * scale_factor;
			scale_canvas.height = task.scale_img.height * scale_factor;
			holder.appendChild(scale_canvas);

			separator = document.createElement('span');
			separator.textContent = ' ⟹ ';
			holder.appendChild(separator);

			task.crop_canvas_ctx = crop_canvas.getContext('2d', { alpha: false });
			task.scale_canvas_ctx = scale_canvas.getContext('2d', { alpha: false });

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
			else if (name === 'field') {
				const field_result = document.createElement('canvas');
				field_result.width = 158;
				field_result.height = 318;
				field_result.classList.add('field_res');
				field_result.style.display = 'inline-block';

				const ctx = field_result.getContext('2d', { alpha: false });
				ctx.fillStyle = '#000000';
				ctx.fillRect(0, 0, 158, 318);

				holder.appendChild(field_result);
			}

			const text_result = document.createElement('pre');
			holder.appendChild(text_result);
		}

		const cropped = await createImageBitmap(task.crop_img,
			0, 0, task.crop_img.width, task.crop_img.height
		);
		const scaled = await createImageBitmap(task.scale_img,
			0, 0, task.scale_img.width, task.scale_img.height
		);

		// draw task captured areas at 2x scale
		task.crop_canvas_ctx.drawImage(cropped,
			0, 0, task.crop_img.width * scale_factor, task.crop_img.height * scale_factor
		);
		task.scale_canvas_ctx.drawImage(scaled,
			0, 0, task.scale_img.width * scale_factor, task.scale_img.height * scale_factor
		);

		// highlight captured areas in source image
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
			const canvas = holder.querySelector(`.field_res`);
			const ctx = canvas.getContext('2d', { alpha: false });

			let colors;

			if (data.level != null) {
				colors = ['#000000', '#ffffff', ...LEVEL_COLORS[data.level % 10]];
			}
			else if (data.color1) {
				colors = ['#000000', toCol(data.color1), toCol(data.color2), toCol(data.color3)];
			}

			canvas.hidden = !!colors;

			if (colors) {
				holder.querySelector(`pre`).textContent = '';

				for (let ridx=0; ridx<20; ridx++) {
					const row = data[name].slice(ridx * 10, ridx * 10 + 10);

					row.forEach((cell, cidx) => {
						ctx.fillStyle = colors[cell || 0];
						ctx.fillRect(
							cidx * 16, ridx * 16, 14, 14
						);
					});
				}
			}
			else {
				const rows = [];

				for (let ridx=0; ridx<20; ridx++) {
					const row = data[name].slice(ridx * 10, ridx * 10 + 10);
					rows.push(row.join(''));
				}

				holder.querySelector(`pre`).textContent = rows.join('\n');
			}
		}
	}
}

function toCol(col_tuple) {
	return `#${[...col_tuple].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function saveConfig(config) {
	// need to drop non-serializable fields
	const config_copy = {
		device_id: config.device_id,
		palette: config.palette,
		frame_rate: config.frame_rate,
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

	resetShowPartsTimer();
}

function hasConfig() {
	return !!localStorage.getItem('config');
}

function loadConfig() {
	const config = localStorage.getItem('config');

	if (config) {
		const parsed = JSON.parse(config);

		if (!parsed.hasOwnProperty('game_type')) {
			parsed.game_type = parsed.tasks.T ? BinaryFrame.GAME_TYPE.CLASSIC : BinaryFrame.GAME_TYPE.DAS_TRAINER;
		}

		return parsed;
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
			dd.textContent = data.field.slice(0, 30).join('');
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
	ocr_corrector = new OCRSanitizer(tetris_ocr, config);

	let start_time = Date.now();
	let gameid = 1;
	let last_frame = { field:[] };

	// TODO: better event system and name for frame data events
	ocr_corrector.onMessage = async function(data) {
		data.game_type = config.game_type || BinaryFrame.GAME_TYPE.CLASSIC;
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

		performance.getEntriesByType("measure").forEach(m => {
			perf[m.name] =  m.duration.toFixed(3);
		});

		showPerfData(perf);
		performance.clearMarks();
		performance.clearMeasures();

		delete data.color1;
		delete data.color2;
		delete data.color3;

		if (data.score === null && data.lines === null) {
			return; // really? 🤔
		}

		// only send frame if changed
		check_equal:
		do {
			for (let key in data) {
				if (key == 'ctime') continue;
				if (key == 'field') {
					if (!data.field.every((v, i) => last_frame.field[i] === v)) {
						break check_equal;
					}
				}
				else if (data[key] != last_frame[key]) {
					break check_equal;
				}
			}

			// all field equals do a sanity check on time
			if (data.ctime - last_frame.ctime >= 500) break;

			// no need to send frame
			return;
		}
		while(false);

		last_frame = data;

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
	resetShowPartsTimer();
}


(async function init() {
	// check if timer should be made visible
	if (QueryString.timer) {
		timer_control.style.display = 'block';
	}

	// load external assets - could parrallelize
	templates = await loadDigitTemplates();
	palettes = await loadPalettes();

	// showTemplates(templates);
	connect();

	await updatePaletteList();

	if (hasConfig()) {
		config = loadConfig();

		// transformation of color numbers for old configs
		// TODO: delete when everyone is using the new config
		if (config.tasks.color1 && !config.tasks.color3) {
			config.tasks.color3 = config.tasks.color2;
			config.tasks.color2 = config.tasks.color1;

			delete config.tasks.color1;
		}

		await resetDevices();

		capture_rate.value = config.frame_rate || default_frame_rate;
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

		capture_rate.value = default_frame_rate;

		ocv = await cv;

		// create default dummy waiting to be populated by user selection
		config = {
			frame_rate: default_frame_rate,
			tasks: {} };
		wizard.style.display = 'block';
	}
})();
