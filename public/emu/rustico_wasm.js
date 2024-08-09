let wasm_bindgen;
(function () {
	const __exports = {};
	let script_src;
	if (typeof document !== 'undefined' && document.currentScript !== null) {
		script_src = new URL(document.currentScript.src, location.href).toString();
	}
	let wasm = undefined;

	let cachedUint8Memory0 = null;

	function getUint8Memory0() {
		if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
			cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
		}
		return cachedUint8Memory0;
	}

	function getArrayU8FromWasm0(ptr, len) {
		ptr = ptr >>> 0;
		return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
	}

	const heap = new Array(128).fill(undefined);

	heap.push(undefined, null, true, false);

	function getObject(idx) {
		return heap[idx];
	}

	let heap_next = heap.length;

	function dropObject(idx) {
		if (idx < 132) return;
		heap[idx] = heap_next;
		heap_next = idx;
	}

	function takeObject(idx) {
		const ret = getObject(idx);
		dropObject(idx);
		return ret;
	}
	/**
	 */
	__exports.wasm_init = function () {
		wasm.wasm_init();
	};

	let WASM_VECTOR_LEN = 0;

	function passArray8ToWasm0(arg, malloc) {
		const ptr = malloc(arg.length * 1, 1) >>> 0;
		getUint8Memory0().set(arg, ptr / 1);
		WASM_VECTOR_LEN = arg.length;
		return ptr;
	}
	/**
	 * @param {Uint8Array} cart_data
	 */
	__exports.load_rom = function (cart_data) {
		const ptr0 = passArray8ToWasm0(cart_data, wasm.__wbindgen_malloc);
		const len0 = WASM_VECTOR_LEN;
		wasm.load_rom(ptr0, len0);
	};

	/**
	 */
	__exports.run_until_vblank = function () {
		wasm.run_until_vblank();
	};

	/**
	 */
	__exports.update_windows = function () {
		wasm.update_windows();
	};

	function addHeapObject(obj) {
		if (heap_next === heap.length) heap.push(heap.length + 1);
		const idx = heap_next;
		heap_next = heap[idx];

		heap[idx] = obj;
		return idx;
	}
	/**
	 * @param {Uint8Array} pixels
	 */
	__exports.draw_screen_pixels = function (pixels) {
		var ptr0 = passArray8ToWasm0(pixels, wasm.__wbindgen_malloc);
		var len0 = WASM_VECTOR_LEN;
		wasm.draw_screen_pixels(ptr0, len0, addHeapObject(pixels));
	};

	/**
	 * @param {Uint8Array} dest
	 */
	__exports.draw_apu_window = function (dest) {
		var ptr0 = passArray8ToWasm0(dest, wasm.__wbindgen_malloc);
		var len0 = WASM_VECTOR_LEN;
		wasm.draw_apu_window(ptr0, len0, addHeapObject(dest));
	};

	/**
	 * @param {Uint8Array} dest
	 */
	__exports.draw_piano_roll_window = function (dest) {
		var ptr0 = passArray8ToWasm0(dest, wasm.__wbindgen_malloc);
		var len0 = WASM_VECTOR_LEN;
		wasm.draw_piano_roll_window(ptr0, len0, addHeapObject(dest));
	};

	/**
	 * @param {number} keystate
	 */
	__exports.set_p1_input = function (keystate) {
		wasm.set_p1_input(keystate);
	};

	/**
	 * @param {number} keystate
	 */
	__exports.set_p2_input = function (keystate) {
		wasm.set_p2_input(keystate);
	};

	/**
	 * @param {number} sample_rate
	 */
	__exports.set_audio_samplerate = function (sample_rate) {
		wasm.set_audio_samplerate(sample_rate);
	};

	/**
	 * @param {number} buffer_size
	 */
	__exports.set_audio_buffersize = function (buffer_size) {
		wasm.set_audio_buffersize(buffer_size);
	};

	/**
	 * @returns {boolean}
	 */
	__exports.audio_buffer_full = function () {
		const ret = wasm.audio_buffer_full();
		return ret !== 0;
	};

	let cachedInt32Memory0 = null;

	function getInt32Memory0() {
		if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
			cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
		}
		return cachedInt32Memory0;
	}

	let cachedInt16Memory0 = null;

	function getInt16Memory0() {
		if (cachedInt16Memory0 === null || cachedInt16Memory0.byteLength === 0) {
			cachedInt16Memory0 = new Int16Array(wasm.memory.buffer);
		}
		return cachedInt16Memory0;
	}

	function getArrayI16FromWasm0(ptr, len) {
		ptr = ptr >>> 0;
		return getInt16Memory0().subarray(ptr / 2, ptr / 2 + len);
	}
	/**
	 * @returns {Int16Array}
	 */
	__exports.get_audio_buffer = function () {
		try {
			const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
			wasm.get_audio_buffer(retptr);
			var r0 = getInt32Memory0()[retptr / 4 + 0];
			var r1 = getInt32Memory0()[retptr / 4 + 1];
			var v1 = getArrayI16FromWasm0(r0, r1).slice();
			wasm.__wbindgen_free(r0, r1 * 2, 2);
			return v1;
		} finally {
			wasm.__wbindgen_add_to_stack_pointer(16);
		}
	};

	/**
	 * @returns {Int16Array}
	 */
	__exports.consume_audio_samples = function () {
		try {
			const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
			wasm.consume_audio_samples(retptr);
			var r0 = getInt32Memory0()[retptr / 4 + 0];
			var r1 = getInt32Memory0()[retptr / 4 + 1];
			var v1 = getArrayI16FromWasm0(r0, r1).slice();
			wasm.__wbindgen_free(r0, r1 * 2, 2);
			return v1;
		} finally {
			wasm.__wbindgen_add_to_stack_pointer(16);
		}
	};

	let cachedUint16Memory0 = null;

	function getUint16Memory0() {
		if (cachedUint16Memory0 === null || cachedUint16Memory0.byteLength === 0) {
			cachedUint16Memory0 = new Uint16Array(wasm.memory.buffer);
		}
		return cachedUint16Memory0;
	}

	function passArray16ToWasm0(arg, malloc) {
		const ptr = malloc(arg.length * 2, 2) >>> 0;
		getUint16Memory0().set(arg, ptr / 2);
		WASM_VECTOR_LEN = arg.length;
		return ptr;
	}
	/**
	 * @param {Uint16Array} addresses
	 * @returns {Uint8Array}
	 */
	__exports.get_ram = function (addresses) {
		try {
			const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
			const ptr0 = passArray16ToWasm0(addresses, wasm.__wbindgen_malloc);
			const len0 = WASM_VECTOR_LEN;
			wasm.get_ram(retptr, ptr0, len0);
			var r0 = getInt32Memory0()[retptr / 4 + 0];
			var r1 = getInt32Memory0()[retptr / 4 + 1];
			var v2 = getArrayU8FromWasm0(r0, r1).slice();
			wasm.__wbindgen_free(r0, r1 * 1, 1);
			return v2;
		} finally {
			wasm.__wbindgen_add_to_stack_pointer(16);
		}
	};

	/**
	 * @returns {Uint8Array}
	 */
	__exports.get_sram = function () {
		try {
			const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
			wasm.get_sram(retptr);
			var r0 = getInt32Memory0()[retptr / 4 + 0];
			var r1 = getInt32Memory0()[retptr / 4 + 1];
			var v1 = getArrayU8FromWasm0(r0, r1).slice();
			wasm.__wbindgen_free(r0, r1 * 1, 1);
			return v1;
		} finally {
			wasm.__wbindgen_add_to_stack_pointer(16);
		}
	};

	/**
	 * @param {Uint8Array} sram
	 */
	__exports.set_sram = function (sram) {
		const ptr0 = passArray8ToWasm0(sram, wasm.__wbindgen_malloc);
		const len0 = WASM_VECTOR_LEN;
		wasm.set_sram(ptr0, len0);
	};

	/**
	 * @returns {boolean}
	 */
	__exports.has_sram = function () {
		const ret = wasm.has_sram();
		return ret !== 0;
	};

	/**
	 * @param {number} mx
	 * @param {number} my
	 */
	__exports.piano_roll_window_click = function (mx, my) {
		wasm.piano_roll_window_click(mx, my);
	};

	async function __wbg_load(module, imports) {
		if (typeof Response === 'function' && module instanceof Response) {
			if (typeof WebAssembly.instantiateStreaming === 'function') {
				try {
					return await WebAssembly.instantiateStreaming(module, imports);
				} catch (e) {
					if (module.headers.get('Content-Type') != 'application/wasm') {
						console.warn(
							'`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
							e
						);
					} else {
						throw e;
					}
				}
			}

			const bytes = await module.arrayBuffer();
			return await WebAssembly.instantiate(bytes, imports);
		} else {
			const instance = await WebAssembly.instantiate(module, imports);

			if (instance instanceof WebAssembly.Instance) {
				return { instance, module };
			} else {
				return instance;
			}
		}
	}

	function __wbg_get_imports() {
		const imports = {};
		imports.wbg = {};
		imports.wbg.__wbindgen_copy_to_typed_array = function (arg0, arg1, arg2) {
			new Uint8Array(
				getObject(arg2).buffer,
				getObject(arg2).byteOffset,
				getObject(arg2).byteLength
			).set(getArrayU8FromWasm0(arg0, arg1));
		};
		imports.wbg.__wbindgen_object_drop_ref = function (arg0) {
			takeObject(arg0);
		};

		return imports;
	}

	function __wbg_init_memory(imports, maybe_memory) {}

	function __wbg_finalize_init(instance, module) {
		wasm = instance.exports;
		__wbg_init.__wbindgen_wasm_module = module;
		cachedInt16Memory0 = null;
		cachedInt32Memory0 = null;
		cachedUint16Memory0 = null;
		cachedUint8Memory0 = null;

		return wasm;
	}

	function initSync(module) {
		if (wasm !== undefined) return wasm;

		const imports = __wbg_get_imports();

		__wbg_init_memory(imports);

		if (!(module instanceof WebAssembly.Module)) {
			module = new WebAssembly.Module(module);
		}

		const instance = new WebAssembly.Instance(module, imports);

		return __wbg_finalize_init(instance, module);
	}

	async function __wbg_init(input) {
		if (wasm !== undefined) return wasm;

		if (typeof input === 'undefined' && typeof script_src !== 'undefined') {
			input = script_src.replace(/\.js$/, '_bg.wasm');
		}
		const imports = __wbg_get_imports();

		if (
			typeof input === 'string' ||
			(typeof Request === 'function' && input instanceof Request) ||
			(typeof URL === 'function' && input instanceof URL)
		) {
			input = fetch(input);
		}

		__wbg_init_memory(imports);

		const { instance, module } = await __wbg_load(await input, imports);

		return __wbg_finalize_init(instance, module);
	}

	wasm_bindgen = Object.assign(__wbg_init, { initSync }, __exports);
})();
