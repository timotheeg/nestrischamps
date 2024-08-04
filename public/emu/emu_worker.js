importScripts('./rustico_wasm.js');

const {
	wasm_init,
	load_rom,
	run_until_vblank,
	set_p1_input,
	set_p2_input,
	set_audio_samplerate,
	set_audio_buffersize,
	audio_buffer_full,
	get_audio_buffer,
	get_ram,
	get_sram,
	set_sram,
	has_sram,
	update_windows,
	draw_piano_roll_window,
	draw_screen_pixels,
	piano_roll_window_click,
	consume_audio_samples,
} = wasm_bindgen;

let initialized = false;
let profiling = {
	run_one_frame: { accumulated_time: 0, count: 0 },
	render_screen: { accumulated_time: 0, count: 0 },
	render_piano_roll: { accumulated_time: 0, count: 0 },
	idle: { accumulated_time: 0, count: 0 },
	render_all_panels: { accumulated_time: 0, count: 0 },
};
let idle_start = 0;
let idle_accumulator = 0;

function collect_profiling(event_name, measured_time) {
	let profile = profiling[event_name];
	profile.accumulated_time += measured_time;
	profile.count += 1;
	// do an average over 10 frames or so
	if (profile.count >= 60) {
		let average = profile.accumulated_time / 60;
		profile.count = 0;
		profile.accumulated_time = 0;
		postMessage({
			type: 'reportPerformance',
			event: event_name,
			average_milliseconds: average,
		});
	}
}

// TODO: The rust side of this *should* be generating appropriate error
// messages. Can we catch those and propogate that error to the UI? That
// would be excellent for users, right now they're just getting silent
// failure.
function load_cartridge(cart_data) {
	load_rom(cart_data);
	set_audio_samplerate(44100);
}

function run_one_frame() {
	let start_time = performance.now();
	run_until_vblank();
	update_windows();
	collect_profiling('run_one_frame', performance.now() - start_time);
}

function get_screen_pixels(dest_array_buffer) {
	let start_time = performance.now();
	//let raw_buffer = new ArrayBuffer(256*240*4);
	//let screen_pixels = new Uint8ClampedArray(raw_buffer);
	let screen_pixels = new Uint8ClampedArray(dest_array_buffer);
	draw_screen_pixels(screen_pixels);
	collect_profiling('render_screen', performance.now() - start_time);
	return dest_array_buffer;
}

function get_piano_roll_pixels(dest_array_buffer) {
	let start_time = performance.now();
	//let raw_buffer = new ArrayBuffer(480*270*4);
	//let screen_pixels = new Uint8ClampedArray(raw_buffer);
	let screen_pixels = new Uint8ClampedArray(dest_array_buffer);
	draw_piano_roll_window(screen_pixels);
	collect_profiling('render_piano_roll', performance.now() - start_time);
	return dest_array_buffer;
}

function handle_piano_roll_window_click(mx, my) {
	piano_roll_window_click(mx, my);
}

const rpc_functions = {
	load_cartridge: load_cartridge,
	run_one_frame: run_one_frame,
	get_screen_pixels: get_screen_pixels,
	get_piano_roll_pixels: get_piano_roll_pixels,
	handle_piano_roll_window_click: handle_piano_roll_window_click,
	has_sram: has_sram,
	get_sram: get_sram,
	set_sram: set_sram,
};

function rpc(task, args, reply_channel) {
	if (rpc_functions.hasOwnProperty(task)) {
		const result = rpc_functions[task].apply(this, args);
		reply_channel.postMessage({ result: result });
	}
}

function handle_message(e) {
	idle_accumulator += performance.now() - idle_start;
	if (e.data.type == 'rpc') {
		rpc(e.data.func, e.data.args, e.ports[0]);
	}
	if (e.data.type == 'requestFrame') {
		// Measure the idle time between each frame, for profiling purposes
		collect_profiling('idle', idle_accumulator);
		idle_accumulator = 0;

		// Run one step of the emulator
		set_p1_input(e.data.p1);
		set_p2_input(e.data.p2);
		run_one_frame();

		let outputPanels = [];
		let transferrableBuffers = [];
		let panel_start_time = performance.now();
		for (let panel of e.data.panels) {
			if (panel.id == 'screen') {
				let image_buffer = get_screen_pixels(panel.dest_buffer);
				outputPanels.push({
					id: 'screen',
					target_element: panel.target_element,
					image_buffer: image_buffer,
					width: 256,
					height: 240,
				});
				transferrableBuffers.push(image_buffer);
			}
		}
		// Only profile a render if we actually drew something
		if (e.data.panels.length > 0) {
			collect_profiling(
				'render_all_panels',
				performance.now() - panel_start_time
			);
		}
		// grab memory values
		const dataSize = e.data.mem_peek.reduce(
			(acc, val, idx) => acc + (idx % 2 ? val : 0),
			0
		);
		const addresses = new Uint16Array(dataSize);
		let offset = 0;
		for (let i = 0; i < e.data.mem_peek.length; i += 2) {
			const startAddr = e.data.mem_peek[i];
			const numBytes = e.data.mem_peek[i + 1];
			for (let j = 0; j < numBytes; j++) {
				addresses[offset++] = startAddr + j;
			}
		}
		const byteValues = get_ram(addresses);

		// TODO: this isn't an ArrayBuffer. It probably should be?
		let audio_buffer = consume_audio_samples();
		postMessage(
			{
				type: 'deliverFrame',
				panels: outputPanels,
				audio_buffer: audio_buffer,
				mem_values: byteValues,
			},
			transferrableBuffers
		);
	}
	idle_start = performance.now();
}

worker_init = function () {
	wasm_init();
	// We are ready to go! Tell the main thread it can kick off execution
	initialized = true;
	postMessage({ type: 'init' });
	self.onmessage = handle_message;
};

wasm_bindgen('./rustico_wasm_bg.wasm').then(worker_init);
