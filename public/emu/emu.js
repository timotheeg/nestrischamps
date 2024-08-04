import { Nostalgist } from 'https://esm.run/nostalgist';
import { MarcFile, parseBPSFile } from '/emu/bps.js';

function showOpenFilePickerPolyfill(options) {
	return new Promise(resolve => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = options.multiple;
		if (options.types) {
			input.accept = options.types
				.map(type => type.accept)
				.flatMap(inst => Object.keys(inst).flatMap(key => inst[key]))
				.join(',');
		}

		input.addEventListener('change', () => {
			resolve(
				[...input.files].map(file => {
					return {
						getFile: async () =>
							new Promise(resolve => {
								resolve(file);
							}),
					};
				})
			);
		});

		input.click();
	});
}

if (typeof window.showOpenFilePicker !== 'function') {
	window.showOpenFilePicker = showOpenFilePickerPolyfill;
}

const first_time = document.querySelector('.first_time');
const patch_url = '/emu/TetrisGYM-6.0.0.bps';

let emulator;

function binArrayToBinString(buffer) {
	return new Uint8Array(buffer).reduce(
		(data, byte) => data + String.fromCharCode(byte),
		''
	);
}

function _arrayBufferToBase64(buffer) {
	return btoa(binArrayToBinString(buffer));
}

function _base64ToArrayBuffer(base64) {
	var binaryString = atob(base64);
	var bytes = new Uint8Array(binaryString.length);
	for (var i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

function initFirstTime() {
	const button = first_time.querySelector('button');

	button.addEventListener('click', async () => {
		const [fileHandle] = await showOpenFilePicker({
			multiple: false,
		});
		const file = await fileHandle.getFile();
		const content = await file.arrayBuffer();

		localStorage.setItem('tetris.nes', _arrayBufferToBase64(content));

		first_time.remove();

		patchVanillaRom(content);
	});

	first_time.style.display = 'block';
}

async function patchVanillaRom(romContent) {
	// fetch patch - store patch in local storage?
	const response = await fetch(patch_url);
	const patchContent = await response.arrayBuffer();

	const romFile = new MarcFile(romContent);
	const patchFile = new MarcFile(patchContent);

	const bps = parseBPSFile(patchFile);

	const gymFile = bps.apply(romFile, true);

	/*
	const nostalgist = await Nostalgist.nes({
		fileName: 'Tetris_Gym_v6.nes',
		fileContent: new Blob([gymFile._u8array]),
	});

    const { AL, Browser, exit, JSEvents, Module } = nostalgist.getEmscripten()
    Module.print = console.log
    /**/

	var nes = new jsnes.NES({
		onFrame: function (frameBuffer) {
			console.log(frameBuffer);
			console.log(nes);
			debugger;
		},
	});

	nes.loadROM(binArrayToBinString(gymFile._u8array));
	nes.frame();
}

function run() {
	const encoded64VanillaRomContent = localStorage.getItem('tetris.nes');
	if (!encoded64VanillaRomContent) {
		initFirstTime();
	} else {
		patchVanillaRom(_base64ToArrayBuffer(encoded64VanillaRomContent));
	}
}

run();