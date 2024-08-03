import { MarcFile, parseBPSFile } from '/emu/bps.js';

const first_time = document.querySelector('.first_time');
const patch_url = '/emu/TetrisGYM-6.0.0.bps';

function _arrayBufferToBase64(buffer) {
	return btoa(
		new Uint8Array(buffer).reduce(
			(data, byte) => data + String.fromCharCode(byte),
			''
		)
	);
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

	await Nostalgist.nes({
		fileName: 'Tetris_Gym_v6.nes',
		fileContent: new Blob([gymFile._u8array]),
	});
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
