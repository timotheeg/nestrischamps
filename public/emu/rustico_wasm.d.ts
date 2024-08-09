declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	/**
	 */
	export function wasm_init(): void;
	/**
	 * @param {Uint8Array} cart_data
	 */
	export function load_rom(cart_data: Uint8Array): void;
	/**
	 */
	export function run_until_vblank(): void;
	/**
	 */
	export function update_windows(): void;
	/**
	 * @param {Uint8Array} pixels
	 */
	export function draw_screen_pixels(pixels: Uint8Array): void;
	/**
	 * @param {Uint8Array} dest
	 */
	export function draw_apu_window(dest: Uint8Array): void;
	/**
	 * @param {Uint8Array} dest
	 */
	export function draw_piano_roll_window(dest: Uint8Array): void;
	/**
	 * @param {number} keystate
	 */
	export function set_p1_input(keystate: number): void;
	/**
	 * @param {number} keystate
	 */
	export function set_p2_input(keystate: number): void;
	/**
	 * @param {number} sample_rate
	 */
	export function set_audio_samplerate(sample_rate: number): void;
	/**
	 * @param {number} buffer_size
	 */
	export function set_audio_buffersize(buffer_size: number): void;
	/**
	 * @returns {boolean}
	 */
	export function audio_buffer_full(): boolean;
	/**
	 * @returns {Int16Array}
	 */
	export function get_audio_buffer(): Int16Array;
	/**
	 * @returns {Int16Array}
	 */
	export function consume_audio_samples(): Int16Array;
	/**
	 * @param {Uint16Array} addresses
	 * @returns {Uint8Array}
	 */
	export function get_ram(addresses: Uint16Array): Uint8Array;
	/**
	 * @returns {Uint8Array}
	 */
	export function get_sram(): Uint8Array;
	/**
	 * @param {Uint8Array} sram
	 */
	export function set_sram(sram: Uint8Array): void;
	/**
	 * @returns {boolean}
	 */
	export function has_sram(): boolean;
	/**
	 * @param {number} mx
	 * @param {number} my
	 */
	export function piano_roll_window_click(mx: number, my: number): void;
}

declare type InitInput =
	| RequestInfo
	| URL
	| Response
	| BufferSource
	| WebAssembly.Module;

declare interface InitOutput {
	readonly memory: WebAssembly.Memory;
	readonly wasm_init: () => void;
	readonly load_rom: (a: number, b: number) => void;
	readonly run_until_vblank: () => void;
	readonly update_windows: () => void;
	readonly draw_screen_pixels: (a: number, b: number, c: number) => void;
	readonly draw_apu_window: (a: number, b: number, c: number) => void;
	readonly draw_piano_roll_window: (a: number, b: number, c: number) => void;
	readonly set_p1_input: (a: number) => void;
	readonly set_p2_input: (a: number) => void;
	readonly set_audio_samplerate: (a: number) => void;
	readonly set_audio_buffersize: (a: number) => void;
	readonly audio_buffer_full: () => number;
	readonly get_audio_buffer: (a: number) => void;
	readonly consume_audio_samples: (a: number) => void;
	readonly get_ram: (a: number, b: number, c: number) => void;
	readonly get_sram: (a: number) => void;
	readonly set_sram: (a: number, b: number) => void;
	readonly has_sram: () => number;
	readonly piano_roll_window_click: (a: number, b: number) => void;
	readonly __wbindgen_malloc: (a: number, b: number) => number;
	readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
	readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {InitInput | Promise<InitInput>} module_or_path
 *
 * @returns {Promise<InitOutput>}
 */
declare function wasm_bindgen(
	module_or_path?: InitInput | Promise<InitInput>
): Promise<InitOutput>;
