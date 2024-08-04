/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function wasm_init(): void;
export function load_rom(a: number, b: number): void;
export function run_until_vblank(): void;
export function update_windows(): void;
export function draw_screen_pixels(a: number, b: number, c: number): void;
export function draw_apu_window(a: number, b: number, c: number): void;
export function draw_piano_roll_window(a: number, b: number, c: number): void;
export function set_p1_input(a: number): void;
export function set_p2_input(a: number): void;
export function set_audio_samplerate(a: number): void;
export function set_audio_buffersize(a: number): void;
export function audio_buffer_full(): number;
export function get_audio_buffer(a: number): void;
export function consume_audio_samples(a: number): void;
export function get_ram(a: number, b: number, c: number): void;
export function get_sram(a: number): void;
export function set_sram(a: number, b: number): void;
export function has_sram(): number;
export function piano_roll_window_click(a: number, b: number): void;
export function __wbindgen_malloc(a: number, b: number): number;
export function __wbindgen_add_to_stack_pointer(a: number): number;
export function __wbindgen_free(a: number, b: number, c: number): void;
