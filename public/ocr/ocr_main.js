import QueryString from '/js/QueryString.js';
import Connection from '/js/connection.js';
import BinaryFrame from '/js/BinaryFrame.js';
import loadDigitTemplates from '/ocr/templates.js';
import loadPalettes from '/ocr/palettes.js';
import GameTracker from '/ocr/GameTracker.js';
import {
	getFieldCoordinates,
	getCaptureCoordinates,
} from '/ocr/calibration.js';
import { peerServerOptions } from '/views/constants.js';
import speak from '/views/tts.js';
import { PIECES } from '/views/constants.js';

// NTSC NES resolution: 256x224 -> 512x448
const LEVEL_COLORS = [
	['#4A32FF', '#4AAFFE'],
	['#009600', '#6ADC00'],
	['#B000D4', '#FF56FF'],
	['#4A32FF', '#00E900'],
	['#C8007F', '#00E678'],
	['#00E678', '#968DFF'],
	['#C41E0E', '#666666'],
	['#8200FF', '#780041'],
	['#4A32FF', '#C41E0E'],
	['#C41E0E', '#F69B00'],
];

const reference_size = [512, 448];
const reference_locations = {
	score: { crop: [384, 112, 94, 14], pattern: 'ADDDDD' },
	score7: { crop: [384, 112, 110, 14], pattern: 'DDDDDDD' },
	level: { crop: [416, 320, 30, 14], pattern: 'TD' }, // TD, because we only care about start level, which is 29 or lower
	lines: { crop: [304, 32, 46, 14], pattern: 'QDD' },
	field_w_borders: { crop: [190, 78, 162, 324] },
	field: { crop: [192, 80, 158, 318] },
	preview: { crop: [384, 224, 62, 30] },
	color1: { crop: [76, 170, 10, 10] },
	color2: { crop: [76, 212, 10, 10] },
	color3: { crop: [76, 246, 10, 10] },
	instant_das: { crop: [80, 64, 30, 14], pattern: 'BD' },
	cur_piece_das: { crop: [112, 96, 30, 14], pattern: 'BD' },
	cur_piece: { crop: [30, 89, 45, 23] },
	T: { crop: [96, 176, 46, 14], pattern: 'BDD', red: true },
	J: { crop: [96, 208, 46, 14], pattern: 'BDD', red: true },
	Z: { crop: [96, 240, 46, 14], pattern: 'BDD', red: true },
	O: { crop: [96, 272, 46, 14], pattern: 'BDD', red: true },
	S: { crop: [96, 304, 46, 14], pattern: 'BDD', red: true },
	L: { crop: [96, 336, 46, 14], pattern: 'BDD', red: true },
	I: { crop: [96, 368, 46, 14], pattern: 'BDD', red: true },
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
			'cur_piece',
		],
	},
	minimal: {
		game_type: BinaryFrame.GAME_TYPE.MINIMAL,
		reference: '/ocr/reference_ui_classic.png',
		palette: 'easiercap',
		fields: ['score', 'level', 'lines', 'field', 'preview'],
	},
};

const send_binary = QueryString.get('binary') !== '0';

const default_frame_rate = 60;

const is_match_room = /^\/room\/u\//.test(new URL(location).pathname);

let do_half_height = true;

export function css_size(css_pixel_width) {
	return parseFloat(css_pixel_width.replace(/px$/, ''));
}

const reference_ui = document.querySelector('#reference_ui'),
	video_capture = document.querySelector('#video_capture'),
	wizard = document.querySelector('#wizard'),
	device_selector = document.querySelector('#device'),
	privacy = document.querySelector('#privacy'),
	allow_video_feed = document.querySelector('#allow_video_feed'),
	video_feed_selector = document.querySelector('#video_feed_device'),
	color_matching = document.querySelector('#color_matching'),
	palette_selector = document.querySelector('#palette'),
	rom_selector = document.querySelector('#rom'),
	controls = document.querySelector('#controls'),
	instructions = document.querySelector('#instructions'),
	capture_rate = document.querySelector('#capture_rate'),
	show_parts = document.querySelector('#show_parts'),
	score7 = document.querySelector('#score7'),
	focus_alarm = document.querySelector('#focus_alarm'),
	clear_config = document.querySelector('#clear_config'),
	save_game_palette = document.querySelector('#save_game_palette'),
	timer_control = document.querySelector('#timer_control'),
	start_timer = document.querySelector('#start_timer'),
	conn_host = document.querySelector('#conn_host'),
	conn_port = document.querySelector('#conn_port'),
	video = document.querySelector('#device_video'),
	ocr_results = document.querySelector('#ocr_results'),
	frame_data = document.querySelector('#frame_data'),
	perf_data = document.querySelector('#perf_data'),
	capture = document.querySelector('#capture'),
	adjustments = document.querySelector('#adjustments'),
	image_corrections = document.querySelector('#image_corrections'),
	brightness_slider = image_corrections.querySelector('.brightness input'),
	brightness_value = image_corrections.querySelector('.brightness span'),
	brightness_reset = image_corrections.querySelector('.brightness a'),
	contrast_slider = image_corrections.querySelector('.contrast input'),
	contrast_value = image_corrections.querySelector('.contrast span'),
	contrast_reset = image_corrections.querySelector('.contrast a');

const UNFOCUSED_ALARM_SND = new Audio('/ocr/alarm.mp3');
const UNFOCUSED_SILENCE_SND = new Audio('/ocr/silence.mp3');
const UNFOCUSED_ALARM_LOOPS = 4;

let templates;
let palettes;
let game_tracker;
let config;
let connection;
let pending_calibration = false;
let in_calibration = false;

device_selector.addEventListener('change', evt => {
	config.device_id = device_selector.value;
	playVideoFromConfig();
	checkReadyToCalibrate();
});

video_feed_selector.addEventListener('change', evt => {
	config.video_feed_device_id = video_feed_selector.value;
	saveConfig(config);
	restartSharingVideoFeed();
});

palette_selector.disabled = true;
palette_selector.addEventListener('change', evt => {
	config.palette = palette_selector.value;
	checkReadyToCalibrate();
});

rom_selector.addEventListener('change', evt => {
	const first_option = palette_selector.querySelector('option:first-child');

	function hideAndResetColorMatching() {
		color_matching.style.display = 'none';
		palette_selector.disabled = true;
	}

	palette_selector.value = palettes._saved ? '_saved' : '';

	if (rom_selector.value === '') {
		hideAndResetColorMatching();
	} else {
		config.game_type = configs[rom_selector.value].game_type;

		color_matching.style.display = 'block';
		palette_selector.disabled = false;

		if (rom_selector.value === 'classic') {
			// Allows all color matching options
			first_option.disabled = false;
			first_option.hidden = false;
		} else {
			first_option.disabled = true;
			first_option.hidden = true;

			const valid_palettes = Object.keys(palettes);

			if (palette_selector.value === '') {
				// read from frame is not allowed!
				palette_selector.value = valid_palettes[0]; // pick first palette as new default
			}

			// If there's a single valid palette, we hide the palette selector
			if (valid_palettes.length <= 1) {
				hideAndResetColorMatching();
			}
		}
	}

	config.palette = palette_selector.value;

	checkReadyToCalibrate();
});

capture_rate.addEventListener('change', updateFrameRate);

function checkReadyToCalibrate() {
	// no need to check palette, if rom_selector has a value, then palette automatically has a valid value too
	const all_ready = device_selector.value && rom_selector.value;

	pending_calibration = !!all_ready;

	instructions.style.display = pending_calibration ? 'block' : 'none';
}

const notice = document.querySelector('div.notice');

function resetNotice() {
	notice.classList.remove('error');
	notice.classList.remove('warning');
	notice.textContent = '';
	notice.style.display = 'none';
}

let peer = null;
let peer_opened = false;
let view_peer_id = null;
let is_player = false;
let view_meta = null;

const API = {
	message(msg) {
		if (QueryString.get('tts') === '1') {
			speak(msg);
		}
	},

	setViewPeerId(_view_peer_id) {
		view_peer_id = _view_peer_id;
	},

	makePlayer(player_index, _view_meta) {
		// producer is player, share video
		is_player = true;
		view_meta = _view_meta;

		startSharingVideoFeed();
	},

	dropPlayer() {
		is_player = false;
		view_meta = null;
		// producer is no longer player
		stopSharingVideoFeed();
	},
};

function connect() {
	if (connection) {
		connection.close();
	}

	connection = new Connection();

	connection.onMessage = function (frame) {
		try {
			const [method, ...args] = frame;

			API[method](...args);
		} catch (e) {
			console.log(`Could not process command ${frame[0]}`);
			console.error(e);
		}
	};

	connection.onKicked = function (reason) {
		resetNotice();
		notice.classList.add('error');
		notice.textContent = `WARNING! The connection has been kicked because [${reason}]. The page will NOT attempt to reconnect.`;
		notice.style.display = 'block';
	};

	connection.onBreak = function () {
		resetNotice();
		notice.classList.add('warning');
		notice.textContent = `WARNING! The page is disconnected. It will try to reconnect automatically.`;
		notice.style.display = 'block';
	};

	connection.onResume = resetNotice;

	connection.onInit = () => {
		if (peer) {
			peer.removeAllListeners();
			peer.destroy();
			peer = null;
			peer_opened = false;
		}

		peer = new Peer(connection.id, peerServerOptions);

		peer.on('open', err => {
			peer_opened = true;
			startSharingVideoFeed();
		});

		peer.on('error', err => {
			console.log(`Peer error: ${err.message}`);
			peer.retryTO = clearTimeout(peer.retryTO); // there should only be one retry scheduled
			peer.retryTO = setTimeout(startSharingVideoFeed, 1500); // we assume this will succeed at some point?? 😰😅
		});
	};
}

let ongoing_call = null;

async function startSharingVideoFeed() {
	console.log('startSharingVideoFeed', view_meta);

	stopSharingVideoFeed();

	if (!allow_video_feed.checked) return;
	if (!video_feed_selector.value) return;
	if (!is_player || !peer || !view_peer_id || !view_meta || !view_meta.video)
		return;

	const video_constraints = {
		width: { ideal: 320 },
		height: { ideal: 240 },
		frameRate: { ideal: 15 }, // players hardly move... no need high fps?
	};

	const m = view_meta.video.match(/^(\d+)x(\d+)$/);

	if (m) {
		video_constraints.width.ideal = parseInt(m[1], 10);
		video_constraints.height.ideal = parseInt(m[2], 10);
	}

	if (video_feed_selector.value === 'default') {
		delete video_constraints.deviceId;
	} else {
		video_constraints.deviceId = { exact: video_feed_selector.value };
	}

	const stream = await navigator.mediaDevices.getUserMedia({
		audio: QueryString.get('webcam_audio') === '1',
		video: video_constraints,
	});

	function startSharing() {
		// 1. player cam
		ongoing_call = peer.call(view_peer_id, stream);

		if (view_meta.raw) {
			// 2. raw capture
			const xywh = [...config.tasks.field.crop];

			if (do_half_height) {
				xywh[1] *= 2;
				xywh[3] *= 2;
			}

			const r_xywh = getCaptureCoordinates(
				reference_size,
				reference_locations.field.crop,
				xywh
			);

			r_xywh[0] /= video.videoWidth;
			r_xywh[1] /= video.videoHeight;
			r_xywh[2] /= video.videoWidth;
			r_xywh[3] /= video.videoHeight;

			peer.call(view_peer_id, video.srcObject, {
				metadata: {
					raw: true,
					r_xywh,
				},
			});
		}
	}

	if (!peer_opened) {
		peer.removeAllListeners('open');
		peer.on('open', startSharing, { once: true });
	} else {
		startSharing();
	}
}

function stopSharingVideoFeed() {
	try {
		ongoing_call.close();
	} catch (err) {}

	ongoing_call = null;
}

function restartSharingVideoFeed() {
	if (!ongoing_call) return;
	startSharingVideoFeed();
}

conn_host.addEventListener('change', connect);
conn_port.addEventListener('change', connect);

clear_config.addEventListener('click', evt => {
	if (
		confirm(
			'You are about to remove your current configuration. You will have to recalibrate. Are you sure?'
		)
	) {
		localStorage.removeItem('config');
		location.reload();
	}
});

save_game_palette.addEventListener('click', evt => {
	if (palettes && game_tracker && config) {
		localStorage.setItem('palette', JSON.stringify(save_game_palette.palette));

		palettes._saved = palette;
		config.palette = '_saved';

		saveConfig(config);
		location.reload();
	}
});

start_timer.addEventListener('click', evt => {
	// minutes are valid per markup restrictions
	const minutes = parseInt(document.querySelector('#minutes').value, 10);

	connection.send(['startTimer', minutes * 60]);
});

video.controls = false;
video.addEventListener('click', async evt => {
	evt.preventDefault();
	if (!pending_calibration || in_calibration) return;

	// TODO: should be a state system
	// pending_calibration = false;
	// in_calibration = true;

	const video_styles = getComputedStyle(video);
	const ratioX = evt.offsetX / css_size(video_styles.width);
	const ratioY = evt.offsetY / css_size(video_styles.height);
	const floodStartPoint = [
		Math.round(video.videoWidth * ratioX),
		Math.round(video.videoHeight * ratioY),
	];

	device_selector.disabled = true;
	rom_selector.disabled = true;

	// set up config per rom selection
	const rom_config = configs[rom_selector.value];

	const video_capture_ctx = video_capture.getContext('2d', { alpha: false });
	const bitmap = await createImageBitmap(
		video,
		0,
		0,
		video.videoWidth,
		video.videoHeight
	);

	updateCanvasSizeIfNeeded(video_capture, video.videoWidth, video.videoHeight);

	if (video.ntcType === 'device') {
		video_capture_ctx.filter = 'brightness(1.75) contrast(1.75)';
	} else {
		video_capture_ctx.filter = 'contrast(1.5)';
	}
	video_capture_ctx.drawImage(bitmap, 0, 0);

	await new Promise(resolve => {
		setTimeout(resolve, 0); // wait one tick for everything to be drawn nicely... just in case
	});

	const img_data = video_capture_ctx.getImageData(
		0,
		0,
		video.videoWidth,
		video.videoHeight
	);

	// get field coordinates via flood-fill (includes borders on all sides)
	const field_w_borders_xywh = getFieldCoordinates(img_data, floodStartPoint);
	console.log('field coordinates', field_w_borders_xywh);

	let [ox, oy, ow, oh] = getCaptureCoordinates(
		reference_size,
		reference_locations.field_w_borders.crop,
		field_w_borders_xywh
	);

	if (ow <= 0 || oh <= 0) {
		console.log('Unable to match template');
		ox = 0;
		oy = 0;
		ow = video.videoWidth;
		oh = video.videoHeight;
	} else {
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

	config.score7 = false;

	saveConfig(config);
	trackAndSendFrames();

	wizard.style.display = 'none';
	privacy.style.display = 'block';
	controls.style.display = 'block';

	if (video.ntcType === 'device') {
		brightness_slider.value = 1.75;
		onBrightnessChange();
	}

	setTimeout(() => {
		alert(
			'Rough calibration has been completed 🎉!\n\nYou now MUST inspect and fine tune all the fields (location and size) to make them pixel perfect!'
		);
	}, 100); // sad (and gross) delay
});

function onShowPartsChanged() {
	const display = show_parts.checked ? 'block' : 'none';

	adjustments.style.display = display;
	// image_corrections.style.display = display;
	config.source_canvas.style.display = display;

	if (show_parts.checked) {
		resetShowPartsTimer();
	}
}

show_parts.addEventListener('change', onShowPartsChanged);

function onScore7Changed() {
	config.score7 = score7.checked;

	const scale6to7 =
		reference_locations.score7.crop[2] / reference_locations.score.crop[2];

	// assume transition is valid
	if (config.score7) {
		config.tasks.score.crop[2] *= scale6to7;
		config.tasks.score.pattern = reference_locations.score7.pattern;
	} else {
		config.tasks.score.crop[2] /= scale6to7;
		config.tasks.score.pattern = reference_locations.score.pattern;
	}

	config.tasks.score.crop[2] = Math.round(config.tasks.score.crop[2]);

	// update score input field for width
	const inputs = document.querySelectorAll(`fieldset.score input`);

	inputs[2].value = config.tasks.score.crop[2];

	resetConfig('score');
}

score7.addEventListener('change', onScore7Changed);

function onPrivacyChanged() {
	config.allow_video_feed = !!allow_video_feed.checked;

	saveConfig(config);

	if (config.allow_video_feed) {
		startSharingVideoFeed();
	} else {
		stopSharingVideoFeed();
	}
}

allow_video_feed.addEventListener('change', onPrivacyChanged);

function onFocusAlarmChanged() {
	config.focus_alarm = !!focus_alarm.checked;

	saveConfig(config);

	if (!config.focus_alarm) {
		stopUnfocusedAlarm(); // shoud not be needed, since window is focused when value changes, but just in case
	}
}

focus_alarm.addEventListener('change', onFocusAlarmChanged);

// ====================
// START: Image corrections

function updateImageCorrection() {
	const filters = [];

	if (config.brightness !== undefined && config.brightness > 1) {
		filters.push(`brightness(${config.brightness})`);
	}

	if (config.contrast !== undefined && config.contrast !== 1) {
		filters.push(`contrast(${config.contrast})`);
	}

	if (filters.length) {
		video.style.filter = filters.join(' ');
	} else {
		video.style.filter = null;
		delete video.style.filter;
	}

	if (game_tracker) {
		game_tracker.setConfig(config);
	}
}

function onBrightnessChange() {
	const value = parseFloat(brightness_slider.value);
	brightness_value.textContent = value.toFixed(2);
	config.brightness = value;
	saveConfig(config);
	updateImageCorrection();
}

function onBrightnessReset(evt) {
	evt.preventDefault();
	brightness_slider.value = 1;
	onBrightnessChange();
}

function onContrastChange() {
	const value = parseFloat(contrast_slider.value);
	contrast_value.textContent = value.toFixed(2);
	config.contrast = value;
	saveConfig(config);
	updateImageCorrection();
}

function onContrastReset(evt) {
	evt.preventDefault();
	contrast_slider.value = 1;
	onContrastChange();
}

brightness_slider.addEventListener('change', onBrightnessChange);
brightness_reset.addEventListener('click', onBrightnessReset);
contrast_slider.addEventListener('change', onContrastChange);
contrast_reset.addEventListener('click', onContrastReset);

// ====================
// STOP: Image corrections

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
			value: '',
		},
		...Object.keys(palettes).map(value => ({
			label: `${value} palette`,
			value,
		})),
	].forEach(option => {
		const palette_option = document.createElement('option');
		palette_option.text = option.label;
		palette_option.value = option.value;

		if (config && config.palette === option.value) {
			palette_option.selected = true;
		}

		palette_selector.appendChild(palette_option);
	});
}

// Updates the select element with the provided set of cameras
function updateDeviceList(devices) {
	// Make sure we show devices with their IDs
	const mappedDevices = devices.map(camera => {
		const device = { label: camera.label, deviceId: camera.deviceId };

		// Drop the manufacturer:make identifier because it's (typically) not useful
		device.label = device.label.replace(
			/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/,
			''
		);

		// Add a short form for the device id
		if (camera.deviceId?.slice) {
			const id = camera.deviceId;
			const shortId = `${id.slice(0, 4)}..${id.slice(-4)}`;
			device.label += ` [${shortId}]`;
		}

		return device;
	});

	const default_devices = [
		{
			label: '-',
			deviceId: '',
		},
		{
			label: 'Window Capture',
			deviceId: 'window',
		},
	];

	if ('serial' in navigator && QueryString.get('ed') === '1') {
		default_devices.splice(1, 0, {
			label: 'Direct Everdrive N8 Pro Capture',
			deviceId: 'everdrive',
		});
	}

	device_selector.innerHTML = '';
	[...default_devices, ...mappedDevices].forEach(camera => {
		const camera_option = document.createElement('option');
		camera_option.text = camera.label;
		camera_option.value = camera.deviceId;

		if (config && config.device_id === camera.deviceId) {
			camera_option.selected = true;
		}

		device_selector.appendChild(camera_option);
	});

	// Then populate for video feed
	// TODO: handle case of no webcam
	video_feed_selector.innerHTML = '';
	[
		{
			label: 'Default',
			deviceId: 'default',
		},
		...mappedDevices,
	].forEach(camera => {
		const camera_option = document.createElement('option');
		camera_option.text = camera.label;
		camera_option.value = camera.deviceId;

		if (config && config.video_feed_device_id === camera.deviceId) {
			camera_option.selected = true;
		}

		video_feed_selector.appendChild(camera_option);
	});
}

async function getConnectedDevices(type) {
	let stream;

	try {
		// prompt for permission if needed
		// on windows, this requests the first available capture device and it may fail
		// BUT if permission has been granted, then listing the devices below might still work
		// SO, we wrap the device call in a try..catch, and ignore errors
		stream = await navigator.mediaDevices.getUserMedia({ video: true });
	} catch (err) {
		// We log a warning but we do nothing
		console.log(
			`Warning: could not open default capture device: $(err.message)`
		);
	}

	const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
		device => device.kind === type && device.deviceId
	);

	if (stream) stream.getTracks()[0].stop();

	return devices;
}

async function resetDevices() {
	const devicesList = await getConnectedDevices('videoinput');
	updateDeviceList(devicesList);
}

navigator.mediaDevices.addEventListener('devicechange', resetDevices);

let start_time;
let frame_duration;
const EVERDRIVE_N8_PRO = { usbVendorId: 0x483, usbProductId: 0x5740 };
let everdrive;
let everdrive_reader;
let everdrive_writer;
const EVERDRIVE_CMD_SEND_STATS = 0x42;
const EVERDRIVE_CMD_MEM_WR = 0x1a;
const EVERDRIVE_ADDR_FIFO = 0x1810000;
const GAME_FRAME_SIZE = 232; // 0xe8
const PIECE_ORIENTATION_TO_PIECE_ID = [
	0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 4, 4, 5, 5, 5, 5, 6, 6,
];
const TILE_ID_TO_NTC_BLOCK_ID = {
	0xef: 0,
	0x7b: 0,
	0x7d: 0,
	0x7c: 0,
};
let data_frame_buffer = new ArrayBuffer(GAME_FRAME_SIZE);

async function initCaptureFromEverdrive() {
	start_time = Date.now();
	frame_duration = 1000 / config.frame_rate;
	const ports = await navigator.serial.getPorts();
	if (ports.length) {
		everdrive = ports.find(port => {
			const { usbProductId, usbVendorId } = port.getInfo();
			return (
				usbVendorId === EVERDRIVE_N8_PRO.usbVendorId &&
				usbProductId === EVERDRIVE_N8_PRO.usbProductId
			);
		});

		if (everdrive) {
			captureFromEverdrive();
		}
	}

	everdrive = await navigator.serial.requestPort({
		filters: [EVERDRIVE_N8_PRO],
	});

	if (everdrive) {
		captureFromEverdrive();
	}
}

async function captureFromEverdrive() {
	await everdrive.open({ baudRate: 57600 }); // plenty of speed for 60fps data frame from gym are 132 bytes: 132x60=7920

	everdrive_reader = everdrive.readable.getReader({ mode: 'byob' });
	everdrive_writer = everdrive.writable.getWriter();

	requestFrameFromEverDrive();
}

function convertTwoBytesToDecimal(byte1, byte2) {
	return byte2 * 100 + (byte1 >> 4) * 10 + (byte1 & 0xf);
}

/*
function updateField(field, tetriminoX, tetriminoY, currentPieceOrientation) {

}
/**/

async function requestFrameFromEverDrive() {
	performance.mark('edlink_comm_start');

	// 0. prep request
	const bytes = [
		// command header
		'+'.charCodeAt(0),
		'+'.charCodeAt(0) ^ 0xff,
		EVERDRIVE_CMD_MEM_WR,
		EVERDRIVE_CMD_MEM_WR ^ 0xff,

		// addr
		EVERDRIVE_ADDR_FIFO & 0xff,
		(EVERDRIVE_ADDR_FIFO >> 8) & 0xff,
		(EVERDRIVE_ADDR_FIFO >> 16) & 0xff,
		(EVERDRIVE_ADDR_FIFO >> 24) & 0xff,
		// len
		1,
		0,
		0,
		0,

		// terminator
		0,

		EVERDRIVE_CMD_SEND_STATS,
	];

	// 1. send request
	await writer.write(new Uint8Array(bytes));

	performance.mark('edlink_write_end');

	// 2. read response
	const { value, done } = await reader.read(new Uint8Array(data_frame_buffer));

	performance.mark('edlink_read_end');

	performance.measure('edlink_write', 'edlink_comm_start', 'edlink_write_end');
	performance.measure('edlink_read', 'edlink_write_end', 'edlink_read_end');
	performance.measure(
		'edlink_comm_total',
		'edlink_comm_start',
		'edlink_read_end'
	);

	const perf = {};

	performance.getEntriesByType('measure').forEach(m => {
		perf[m.name] = m.duration.toFixed(3);
	});

	showPerfData(perf);

	performance.clearMarks();
	performance.clearMeasures();

	if (done) {
		reader.releaseLock();
		return;
	}

	const [
		// 0
		gameMode,
		playState,
		completedRowYClear,
		completedRow0,
		completedRow1,
		completedRow2,
		completedRow3,
		lines0,
		lines1,
		level,
		// 10
		score0,
		score1,
		score2,
		score3,
		nextPieceOrientation,
		currentPieceOrientation,
		tetriminoX,
		tetriminoY,
		statsT0,
		statsT1,
		// 20
		statsJ0,
		statsJ1,
		statsZ0,
		statsZ1,
		statsO0,
		statsO1,
		statsS0,
		statsS1,
		statsL0,
		statsL1,
		// 30
		statsI0,
		statsI1,
		// 32
		...field
	] = value;

	console.log({
		gameMode,
		playState,
		completedRowYClear,
		completedRow0,
		completedRow1,
		completedRow2,
		completedRow3,
		lines0,
		lines1,
		level,
		score0,
		score1,
		score2,
		score3,
		nextPieceOrientation,
		currentPieceOrientation,
		tetriminoX,
		tetriminoY,
		statsT0,
		statsT1,
		statsJ0,
		statsJ1,
		statsZ0,
		statsZ1,
		statsO0,
		statsO1,
		statsS0,
		statsS1,
		statsL0,
		statsL1,
		statsI0,
		statsI1,
		field,
	});

	// 4. update field as needed (draw piece + clear animation)
	// TODO

	// 5. get the frame payload
	const data = {
		gameid: 0, // TODO: derive game id properly
		ctime: Date.now() - start_time,
		game_type: BinaryFrame.GAME_TYPE.CLASSIC,
		lines: convertTwoBytesToDecimal(lines0, lines1),
		level,
		score: ((score3 << (24 + score2)) << (16 + score1)) << (8 + score0),
		T: convertTwoBytesToDecimal(statsT0, statsT1),
		J: convertTwoBytesToDecimal(statsJ0, statsJ1),
		Z: convertTwoBytesToDecimal(statsZ0, statsZ1),
		O: convertTwoBytesToDecimal(statsO0, statsO1),
		S: convertTwoBytesToDecimal(statsS0, statsS1),
		L: convertTwoBytesToDecimal(statsL0, statsL1),
		I: convertTwoBytesToDecimal(statsI0, statsI1),
		preview: PIECE_ORIENTATION_TO_PIECE_ID[nextPieceOrientation] ?? 3,
		field: field.map(tile_id => TILE_ID_TO_NTC_BLOCK_ID[tile_id] ?? 0),
	};

	showFrameData(data);

	// TODO: implement frame dedupping like for OCR capture...

	// 6. transmit frame to NTC server
	if (QueryString.get('edtx') === '1') {
		connection.send(BinaryFrame.encode(data));
	}

	// 7. schedule next poll, assume no lag; TODO: check for dropped frame
	const now = Date.now();
	const elapsed = now - start_time;
	const frames_elapsed = Math.floor(elapsed / frame_duration);
	const next_frame_time = Math.ceil((frames_elapsed + 1) * frame_duration);

	setTimeout(requestFrameFromEverDrive, next_frame_time - Date.now());
}

async function playVideoFromDevice(device_id, fps) {
	try {
		const constraints = {
			audio: false,
			video: {
				height: { ideal: 480 },
				frameRate: { ideal: fps }, // Should we always try to get the highest the card can support?
			},
		};

		if (device_id) {
			constraints.video.deviceId = { exact: device_id };
		}

		const stream = await navigator.mediaDevices.getUserMedia(constraints);

		// we only prompt for permission with the first call
		if (device_id === undefined) return;

		// when an actual device id is supplied, we start everything
		video.srcObject = stream;
		video.ntcType = 'device';
		video.play();
	} catch (error) {
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
				frameRate: { ideal: fps },
			},
		};

		const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

		// when an actual device id is supplied, we start everything
		video.srcObject = stream;
		video.ntcType = 'screencap';
		video.play();
	} catch (error) {
		console.error('Error capturing window.', error);
		video.pause();
	}
}

async function playVideoFromConfig() {
	if (!config.device_id) {
		return;
	}

	if (config.device_id === 'everdrive') {
		await initCaptureFromEverdrive(config.frame_rate);
	} else if (config.device_id === 'window') {
		do_half_height = false;
		await playVideoFromScreenCap(config.frame_rate);
	} else {
		do_half_height = true && QueryString.get('disable_half_height') != '1';
		await playVideoFromDevice(config.device_id, config.frame_rate);
	}

	capture_rate
		.querySelectorAll('.device_only')
		.forEach(elmt => (elmt.hidden = config.device_id === 'window'));
}

let capture_process, blob;
let frame_count = 0;

async function updateFrameRate() {
	try {
		video.srcObject.getVideoTracks()[0].stop();
	} catch (err) {}

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

	console.log(
		`Video settings: ${settings.width}x${
			settings.height
		}@${settings.frameRate.toFixed(1)}fps`
	);

	if (stream.asset) {
		const response = await fetch(stream.asset);
		blob = await response.blob();
	}

	if (show_parts.checked) {
		adjustments.style.display = 'block';
		// image_corrections.style.display = 'block';
		ocr_results.style.display = 'flex';
	}

	const frame_ms = 1000 / settings.frameRate;

	console.log(
		`Setting capture interval for ${settings.frameRate}fps (i.e. ${frame_ms}ms per frame)`
	);
	capture_process = setInterval(captureFrame, frame_ms);
}

let last_frame_time = 0;

let unfocused_alarm_loop_counter = 0;
let unfocused_abnormal_elapsed = 750; // If capture interval runs at 750ms, capture is messed
let unfocused_alarm_playing = false;

let unfocused_smoothing_factor = 1 / 15; // causes roughly 20s delay from when interval jumps from 33ms to 1000ms
let unfocused_smoothed_elapsed = 0;

function playUnfocusedAlarm() {
	if (!unfocused_alarm_playing) return;

	unfocused_alarm_loop_counter =
		++unfocused_alarm_loop_counter % UNFOCUSED_ALARM_LOOPS;

	if (unfocused_alarm_loop_counter === 0) {
		// Say Message
		delete UNFOCUSED_ALARM_SND.onended;
		speak(
			{
				username: '_system',
				display_name: 'System',
				message: 'Warning! Nestris champs OCR page is not active!',
			},
			{ now: true, callback: playUnfocusedAlarm }
		);
	} else {
		// Play alarm
		UNFOCUSED_ALARM_SND.onended = playUnfocusedAlarm;
		UNFOCUSED_ALARM_SND.play();
	}
}

function startUnfocusedAlarm() {
	if (unfocused_alarm_playing) return;

	unfocused_alarm_playing = true;
	unfocused_alarm_loop_counter = 0;
	playUnfocusedAlarm();

	// play silence sound continuously to disable timer throttling
	UNFOCUSED_SILENCE_SND.loop = true;
	UNFOCUSED_SILENCE_SND.play();

	window.addEventListener('focus', stopUnfocusedAlarm);
}

function stopUnfocusedAlarm() {
	delete UNFOCUSED_ALARM_SND.onended;
	unfocused_alarm_playing = false;
	unfocused_smoothed_elapsed = 0;

	UNFOCUSED_ALARM_SND.pause();
	UNFOCUSED_SILENCE_SND.pause();

	window.removeEventListener('focus', stopUnfocusedAlarm);
}

async function captureFrame() {
	++frame_count;

	const now = Date.now();

	if (focus_alarm.checked && last_frame_time) {
		const elapsed = Date.now() - last_frame_time;

		unfocused_smoothed_elapsed =
			unfocused_smoothing_factor * elapsed +
			(1 - unfocused_smoothing_factor) * unfocused_smoothed_elapsed;

		if (unfocused_smoothed_elapsed > unfocused_abnormal_elapsed) {
			startUnfocusedAlarm();
		}
	}

	last_frame_time = now;

	try {
		let bitmap;
		let force_half_height = false;

		// let's assume that pixelated resize of height divided 2 is the same as dropping every other row
		// which is equivalent to deinterlacing *cough*

		performance.mark('capture_start');
		if (blob) {
			force_half_height = true;
			// images are known to be 720x480
			bitmap = await createImageBitmap(blob, 0, 0, 720, 480);
		} else {
			// we do cheap deinterlacing with pixelated resize...
			bitmap = await createImageBitmap(
				video,
				0,
				0,
				video.videoWidth,
				video.videoHeight
			);
		}
		performance.mark('capture_end');

		game_tracker.processFrame(bitmap, do_half_height || force_half_height);
	} catch (err) {
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
		for (let p_idx = template.length; p_idx--; ) {
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

		// must restore no smoothing after change of size
		canvas.getContext('2d', { alpha: false }).imageSmoothingEnabled = false;
	}
}

function resetConfig(task_name) {
	if (task_name) {
		const task_crop = [
			...document.querySelectorAll(
				`#adjustments fieldset.${task_name} input.coordinate_input`
			),
		].map(el => parseInt(el.value, 10));

		config.tasks[task_name].crop = task_crop;

		// update display canvas with new data
		const canvas = config.tasks[task_name].crop_canvas_ctx.canvas;
		const scale_factor = task_name.startsWith('color') ? 4 : 2;

		updateCanvasSizeIfNeeded(
			canvas,
			task_crop[2] * scale_factor,
			task_crop[3] * scale_factor
		);
	}

	// set the new config - this may reset the scale_img size for score
	game_tracker.setConfig(config);

	if (task_name === 'score') {
		const canvas = config.tasks.score.scale_canvas_ctx.canvas;
		const scale_factor = 2;
		const scale_img = config.tasks.score.scale_img;

		updateCanvasSizeIfNeeded(
			canvas,
			scale_img.width * scale_factor,
			scale_img.height * scale_factor
		);
	}

	updateCanvasSizeIfNeeded(
		config.source_canvas,
		config.capture_area.w,
		config.capture_area.h
	);

	saveConfig(config);
}

function bindPieceStatsXWInputs() {
	// bind field 0 (x) and 2 (width)
	[0, 2].forEach(input_idx => {
		const inputs = PIECES.map(name =>
			document.querySelector(`fieldset.${name}`)
		).map(parent => parent.querySelectorAll('input')[input_idx]);

		inputs.forEach(input => {
			input.addEventListener('change', () => {
				const value = input.value;
				inputs.forEach((link, idx) => {
					if (link === input) return;
					link.value = value;
					resetConfig(PIECES[idx]);
				});
			});
		});
	});
}

function bindColorsXInputs() {
	const inputs = [1, 2, 3]
		.map(num => document.querySelector(`fieldset.color${num}`))
		.map(parent => parent.querySelectorAll('input')[0]);

	inputs.forEach(input => {
		input.addEventListener('change', () => {
			const value = input.value;
			inputs.forEach((link, idx) => {
				if (link === input) return;
				link.value = value;
				resetConfig(`color${idx + 1}`);
			});
		});
	});
}

function showColorControls(palettes, config) {
	const has_valid_palette = !!(config.palette && palettes[config.palette]);
	const display = has_valid_palette ? 'none' : 'block';

	const color_fieldset = document.querySelector(`fieldset.color1`);

	if (!color_fieldset) return;

	[1, 2, 3].forEach(num => {
		const col_elmt = document.querySelector(`fieldset.color${num}`);

		if (col_elmt) {
			col_elmt.style.display = display;
		}
	});

	if (!has_valid_palette) bindColorsXInputs();
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
		canvas_holder.classList.add('results');
		fieldset.appendChild(canvas_holder);

		adjustments.appendChild(fieldset);
	}

	showColorControls(palettes, config);

	if (config.tasks.T) {
		bindPieceStatsXWInputs();
	}
}

function addCropControls(parent, config, name, onChangeCallback) {
	const holder = document.createElement('div');
	const inputs = [];

	function onChange() {
		onChangeCallback(name);
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

	di_ctx.putImageData(
		config.source_img,
		0,
		0,
		0,
		0,
		config.source_img.width,
		source_height
	);

	di_ctx.fillStyle = '#FFA50080';

	const x_offset = config.capture_area.x;
	const y_offset = config.capture_area.y;

	for (const name of Object.keys(data)) {
		if (config.palette && name.startsWith('color')) continue;

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
			} else if (name === 'field') {
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

		const cropped = await createImageBitmap(
			task.crop_img,
			0,
			0,
			task.crop_img.width,
			task.crop_img.height
		);
		const scaled = await createImageBitmap(
			task.scale_img,
			0,
			0,
			task.scale_img.width,
			task.scale_img.height
		);

		// draw task captured areas at 2x scale
		task.crop_canvas_ctx.drawImage(
			cropped,
			0,
			0,
			task.crop_img.width * scale_factor,
			task.crop_img.height * scale_factor
		);
		task.scale_canvas_ctx.drawImage(
			scaled,
			0,
			0,
			task.scale_img.width * scale_factor,
			task.scale_img.height * scale_factor
		);

		// highlight captured areas in source image
		const [x, y, w, h] = task.crop;
		di_ctx.fillRect(x - x_offset, y - y_offset, w, h);

		// show text result
		if (name.startsWith('color')) {
			const color = `rgb(${data[name][0]},${data[name][1]},${data[name][2]})`;

			holder.querySelector(`.col_res`).style.backgroundColor = color;
			holder.querySelector(`pre`).textContent = color;
		} else if (name != 'field') {
			holder.querySelector(`pre`).innerHTML =
				data[name] === null ? '&nbsp;' : data[name];
		} else {
			const canvas = holder.querySelector(`.field_res`);
			const ctx = canvas.getContext('2d', { alpha: false });

			let colors;

			if (data.level != null && !isNaN(data.level)) {
				colors = ['#000000', '#ffffff', ...LEVEL_COLORS[data.level % 10]];
			} else if (data.color1) {
				colors = [
					'#000000',
					toCol(data.color1),
					toCol(data.color2),
					toCol(data.color3),
				];
			}

			canvas.hidden = !!colors;

			if (colors) {
				holder.querySelector(`pre`).textContent = '';

				for (let ridx = 0; ridx < 20; ridx++) {
					const row = data[name].slice(ridx * 10, ridx * 10 + 10);

					row.forEach((cell, cidx) => {
						ctx.fillStyle = colors[cell || 0];
						ctx.fillRect(cidx * 16, ridx * 16, 14, 14);
					});
				}
			} else {
				const rows = [];

				for (let ridx = 0; ridx < 20; ridx++) {
					const row = data[name].slice(ridx * 10, ridx * 10 + 10);
					rows.push(row.join(''));
				}

				holder.querySelector(`pre`).textContent = rows.join('\n');
			}
		}
	}
}

function toCol(col_tuple) {
	return `#${[...col_tuple]
		.map(v => v.toString(16).padStart(2, '0'))
		.join('')}`;
}

function saveConfig(config) {
	// need to drop non-serializable fields
	const config_copy = {
		device_id: config.device_id,
		game_type: config.game_type,
		palette: config.palette,
		frame_rate: config.frame_rate,
		focus_alarm: config.focus_alarm,
		allow_video_feed: config.allow_video_feed,
		video_feed_device_id: config.video_feed_device_id,
		brightness: config.brightness,
		contrast: config.contrast,
		score7: config.score7,
		tasks: {},
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

function getGameTypeFromTasks(tasks) {
	return tasks.T
		? BinaryFrame.GAME_TYPE.CLASSIC
		: tasks.cur_piece_das
		? BinaryFrame.GAME_TYPE.DAS_TRAINER
		: BinaryFrame.GAME_TYPE.MINIMAL;
}

function loadConfig() {
	const config = localStorage.getItem('config');

	if (config) {
		const parsed = JSON.parse(config);

		if (!parsed.hasOwnProperty('game_type')) {
			parsed.game_type = getGameTypeFromTasks(parsed.tasks);
		}

		return parsed;
	}
}

function showFrameData(data) {
	// TODO: fix markup on config change, rather than destroy-rebuild at every frame
	frame_data.innerHTML = '';

	for (const [name, value] of Object.entries(data)) {
		if (name === 'raw') continue;

		const dt = document.createElement('dt');
		const dd = document.createElement('dd');

		dt.textContent = name;
		if (name === 'field') {
			dd.textContent = data.field.slice(0, 30).join('');
		} else {
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

	game_tracker = new GameTracker(templates, palettes, config);

	let start_time = Date.now();
	let last_frame = { field: [] };

	game_tracker.onNewGame = () => {
		save_game_palette.disabled = true;
	};

	// Palette is ready to be used
	game_tracker.onPalette = () => {
		save_game_palette.palette = game_tracker.palette;
		save_game_palette.disabled = false;
	};

	// TODO: better event system and name for frame data events
	game_tracker.onMessage = async function (data) {
		data.game_type = config.game_type ?? BinaryFrame.GAME_TYPE.CLASSIC;
		data.ctime = Date.now() - start_time;

		if (show_parts.checked) {
			performance.mark('show_parts_start');
			await showParts(data.raw); // show OCR values with no processing
			performance.mark('show_parts_end');
			try {
				performance.measure('show_parts', 'show_parts_start', 'show_parts_end');
			} catch (err) {}
		}

		const perf = {};

		try {
			performance.measure('capture', 'capture_start', 'capture_end');
		} catch (err) {}

		performance.mark('show_frame_data_start');
		showFrameData(data);
		performance.mark('show_frame_data_end');
		performance.measure(
			'show_frame_data',
			'show_frame_data_start',
			'show_frame_data_end'
		);

		performance.mark('process_over');

		try {
			performance.measure('total', 'capture_start', 'process_over');
		} catch (err) {}

		performance.getEntriesByType('measure').forEach(m => {
			perf[m.name] = m.duration.toFixed(3);
		});

		showPerfData(perf);
		performance.clearMarks();
		performance.clearMeasures();

		// delete data fields which are never meant to be sent over the wire
		delete data.color1;
		delete data.color2;
		delete data.color3;
		delete data.gym_pause_active;
		delete data.raw;

		// only send frame if changed
		check_equal: do {
			for (let key in data) {
				if (key == 'ctime') continue;
				if (key == 'field') {
					if (!data.field.every((v, i) => last_frame.field[i] === v)) {
						break check_equal;
					}
				} else if (data[key] != last_frame[key]) {
					break check_equal;
				}
			}

			// all fields equal, do a sanity check on time
			if (data.ctime - last_frame.ctime >= 250) break; // max 1 in 15 frames (4fps)

			// no need to send frame
			return;
		} while (false);

		last_frame = data;

		if (send_binary) {
			connection.send(BinaryFrame.encode(data));
		} else {
			// convert Uint8Array to normal array so it can be json-encoded properly
			data.field = [...data.field];
			connection.send(data);
		}
	};

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
	if (QueryString.get('timer') === '1') {
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

		score7.checked = config.score7 === true;
		allow_video_feed.checked = config.allow_video_feed != false;
		focus_alarm.checked = config.focus_alarm != false;
		privacy.style.display = 'block';

		const brightness = config.brightness === undefined ? 1 : config.brightness;
		brightness_slider.value = config.brightness = brightness;
		brightness_value.textContent = brightness.toFixed(2);

		const contrast = config.contrast === undefined ? 1 : config.contrast;
		contrast_slider.value = config.contrast = contrast;
		contrast_value.textContent = contrast.toFixed(2);

		updateImageCorrection();

		await playVideoFromConfig();
		trackAndSendFrames();
	} else {
		await resetDevices();

		capture_rate.value = default_frame_rate;

		// create default dummy waiting to be populated by user selection
		config = {
			frame_rate: default_frame_rate,
			tasks: {},
		};
		wizard.style.display = 'block';
	}

	try {
		window.__usb_devices = await navigator.usb.getDevices();
	} catch (err) {
		console.error(err);
	}
})();
