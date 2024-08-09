// Note: The following variable is global, and represents our live button state for the emulator:
// var keys = [0,0];

var keys = [0, 0, 0];
var touch_keys = [0, 0, 0];
var remap_key = false;
var remap_index = 0;
var remap_slot = 1;

var controller_keymaps = [];

controller_keymaps[1] = [
	'x',
	'z',
	'Shift',
	'Enter',
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
];

controller_keymaps[2] = ['-', '-', '-', '-', '-', '-', '-', '-'];

window.addEventListener('keydown', function (event) {
	if (remap_key) {
		if (event.key != 'Escape') {
			controller_keymaps[remap_slot][remap_index] = event.key;
		} else {
			controller_keymaps[remap_slot][remap_index] = '-';
		}
		remap_key = false;
		displayButtonMappings();
		saveInputConfig();
		return;
	}
	for (var c = 1; c <= 2; c++) {
		for (var i = 0; i < 8; i++) {
			if (event.key == controller_keymaps[c][i]) {
				keys[c] = keys[c] | (0x1 << i);
			}
		}
	}
	if (event.key == 'p') {
		var debug_box = document.querySelector('#debug-box');
		debug_box.classList.toggle('active');
	}
});

window.addEventListener('keyup', function (event) {
	for (var c = 1; c <= 2; c++) {
		for (var i = 0; i < 8; i++) {
			if (event.key == controller_keymaps[c][i]) {
				keys[c] = keys[c] & ~(0x1 << i);
			}
		}
	}
});

var controller_padmaps = [];
controller_padmaps[1] = ['-', '-', '-', '-', '-', '-', '-', '-'];
controller_padmaps[2] = ['-', '-', '-', '-', '-', '-', '-', '-'];

var gamepads = [];

var idle_interval = setInterval(updateGamepads, 500);

window.addEventListener('gamepadconnected', function (e) {
	var gp = navigator.getGamepads()[e.gamepad.index];
	console.log(
		'Recognized new gamepad! Index: ',
		e.gamepad.index,
		' Buttons: ',
		gp.buttons.length,
		' Axis: ',
		gp.axes.length
	);
	gamepads[e.gamepad.index] = gamepadState(gp);
});

function gamepadState(gamepad) {
	var state = { buttons: [], axes: [] };
	for (var b = 0; b < gamepad.buttons.length; b++) {
		state.buttons[b] = gamepad.buttons[b].pressed;
	}
	for (var a = 0; a < gamepad.axes.length; a++) {
		state.axes[a] = gamepad.axes[a];
	}
	return state;
}

function updateGamepads() {
	for (var i = 0; i < gamepads.length; i++) {
		var old_state = gamepads[i];
		if (old_state) {
			gp = navigator.getGamepads()[i];
			if (gp) {
				var new_state = gamepadState(gp);
				for (var b = 0; b < old_state.buttons.length; b++) {
					if (old_state.buttons[b] == false && new_state.buttons[b] == true) {
						gamepadDown('PAD(' + i + '): BUTTON(' + b + ')');
					}
					if (old_state.buttons[b] == true && new_state.buttons[b] == false) {
						gamepadUp('PAD(' + i + '): BUTTON(' + b + ')');
					}
				}
				for (var a = 0; a < old_state.axes.length; a++) {
					if (old_state.axes[a] < 0.5 && new_state.axes[a] >= 0.5) {
						gamepadDown('PAD(' + i + '): AXIS(' + a + ')+');
					}
					if (old_state.axes[a] > -0.5 && new_state.axes[a] <= -0.5) {
						gamepadDown('PAD(' + i + '): AXIS(' + a + ')-');
					}

					if (old_state.axes[a] >= 0.5 && new_state.axes[a] < 0.5) {
						gamepadUp('PAD(' + i + '): AXIS(' + a + ')+');
					}
					if (old_state.axes[a] <= -0.5 && new_state.axes[a] > -0.5) {
						gamepadUp('PAD(' + i + '): AXIS(' + a + ')-');
					}
				}
				gamepads[i] = new_state;
			}
		}
	}
}

function gamepadDown(button_name) {
	if (remap_key) {
		controller_padmaps[remap_slot][remap_index] = button_name;
		remap_key = false;
		displayButtonMappings();
		saveInputConfig();
		return;
	}
	for (var c = 1; c <= 2; c++) {
		for (var i = 0; i < 8; i++) {
			if (button_name == controller_padmaps[c][i]) {
				keys[c] = keys[c] | (0x1 << i);
			}
		}
	}
}

function gamepadUp(button_name) {
	if (remap_key) {
		controller_padmaps[remap_slot][remap_index] = button_name;
		remap_key = false;
		displayButtonMappings();
		return;
	}
	for (var c = 1; c <= 2; c++) {
		for (var i = 0; i < 8; i++) {
			if (button_name == controller_padmaps[c][i]) {
				keys[c] = keys[c] & ~(0x1 << i);
			}
		}
	}
}

function displayButtonMappings() {
	var buttons = document.querySelectorAll('#configure_input button');
	buttons.forEach(function (button) {
		var key_index = button.getAttribute('data-key');
		var key_slot = button.getAttribute('data-slot');
		button.innerHTML =
			controller_keymaps[key_slot][key_index] +
			' / ' +
			controller_padmaps[key_slot][key_index];
		button.classList.remove('remapping');
	});
}

function remapButton() {
	displayButtonMappings();
	this.classList.add('remapping');
	this.innerHTML = '...';
	remap_key = true;
	remap_index = this.getAttribute('data-key');
	remap_slot = this.getAttribute('data-slot');
	this.blur();
}

function initializeButtonMappings() {
	displayButtonMappings();
	var buttons = document.querySelectorAll('#configure_input button');
	buttons.forEach(function (button) {
		button.addEventListener('click', remapButton);
	});
}

function saveInputConfig() {
	try {
		window.localStorage.setItem(
			'keyboard_1',
			JSON.stringify(controller_keymaps[1])
		);
		window.localStorage.setItem(
			'keyboard_2',
			JSON.stringify(controller_keymaps[2])
		);
		window.localStorage.setItem(
			'gamepad_1',
			JSON.stringify(controller_padmaps[1])
		);
		window.localStorage.setItem(
			'gamepad_2',
			JSON.stringify(controller_padmaps[2])
		);
		console.log('Input Config Saved!');
	} catch (e) {
		console.log(
			'Local Storage is probably unavailable! Input configuration will not persist.'
		);
	}
}

function loadInputConfig() {
	try {
		var keyboard_1 = window.localStorage.getItem('keyboard_1');
		if (keyboard_1) {
			controller_keymaps[1] = JSON.parse(keyboard_1);
		}
		var keyboard_2 = window.localStorage.getItem('keyboard_2');
		if (keyboard_2) {
			controller_keymaps[2] = JSON.parse(keyboard_2);
		}
		var gamepad_1 = window.localStorage.getItem('gamepad_1');
		if (gamepad_1) {
			controller_padmaps[1] = JSON.parse(gamepad_1);
		}
		var gamepad_2 = window.localStorage.getItem('gamepad_2');
		if (gamepad_2) {
			controller_padmaps[2] = JSON.parse(gamepad_2);
		}
		console.log('Input Config Loaded!');
		displayButtonMappings();
	} catch (e) {
		console.log(
			'Local Storage is probably unavailable! Input configuration will not persist.'
		);
	}
}

KEY_A = 1;
KEY_B = 2;
KEY_SELECT = 4;
KEY_START = 8;
KEY_UP = 16;
KEY_DOWN = 32;
KEY_LEFT = 64;
KEY_RIGHT = 128;

BUTTON_MAPPING = {
	button_a: KEY_A,
	button_b: KEY_B,
	button_ab: KEY_A | KEY_B,
	button_start: KEY_START,
	button_select: KEY_SELECT,
};

DIRECTION_MAPPING = {
	up: KEY_UP,
	down: KEY_DOWN,
	left: KEY_LEFT,
	right: KEY_RIGHT,
};

function updateTouchKeys() {
	p1_keys = 0;
	// Iterate over the button and d-pad states and collect the key status in a byte
	// Note: only implemented for P1 at the moment
	for (let touch_identifier in active_touches) {
		active_touch = active_touches[touch_identifier];
		if (BUTTON_MAPPING.hasOwnProperty(active_touch.button)) {
			p1_keys = p1_keys | BUTTON_MAPPING[active_touch.button];
		}
		if (active_touch.dpad != null) {
			for (let direction of active_touch.directions) {
				if (DIRECTION_MAPPING.hasOwnProperty(direction)) {
					p1_keys = p1_keys | DIRECTION_MAPPING[direction];
				}
			}
		}
	}
	// Because we allow multiple touch points to activate the same D-pad input, we might accidentally produce a directional combination
	// that should be disallowed on real hardware. Let's sanity check this and make sure we disallow U+D and L+R
	p1_up_left = p1_keys & (KEY_UP | KEY_LEFT);
	p1_down_right = p1_up_left << 1;
	p1_down_right_mask = p1_down_right ^ 0xff;

	touch_keys[1] = p1_keys & p1_down_right_mask;
}
